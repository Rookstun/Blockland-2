// In-game AI chat bot. Players type `!ai <message>` and the reply is
// broadcast to the server. Requests go through a free-claude-code (FCC)
// proxy, which speaks the Anthropic Messages API and routes to whatever
// provider/model FCC is configured with (NVIDIA NIM, OpenRouter, ...).
//
// The model also gets build tools: it describes bricks relative to the
// player who asked, and the plugin writes them as a temporary .brz prefab
// (brs-js, same as the terrain plugin) and loads it into the live world.
// Every build gets its own brick owner so it can be undone on its own.
//
// Pictures: build_image (and `!img <url>`) downloads an image, scales it
// down with ffmpeg and converts it with heightmap2brz (bin/heightmap, from
// https://github.com/brickadia-community/heightmap2brz releases). Its bricks
// are then re-owned and loaded the same way as any other build.
//
// Unsafe (plain node) plugin: it needs node_modules and sends the current
// game's br.* commands directly, since older Omegga versions still send
// the pre-rename names.

const fs = require('fs');
const os = require('os');
const net = require('net');
const dns = require('dns').promises;
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { AsyncLocalStorage } = require('async_hooks');
const { pathToFileURL } = require('url');
const Anthropic = require('@anthropic-ai/sdk');
const shapes = require('./lib/shapes');
const { render } = require('./lib/render');

const EVENTS = ['chatcmd:ai', 'cmd:ai']; // "!ai" and "/ai"
// (owner 2026-10-15: "hide !ai for now") true = !ai is ignored silently and left out of help
const AI_HIDDEN = false;
const AGENT_EVENTS = ['chatcmd:agent', 'cmd:agent']; // "!agent" and "/agent"
const IMAGE_EVENTS = ['chatcmd:img', 'cmd:img', 'chatcmd:image', 'cmd:image']; // "!img"/"!image" and "/img"/"/image"
const HEIGHTMAP = path.join(__dirname, 'bin', 'heightmap');
const GRIDHOUSE = path.join(__dirname, 'lib', 'gridhouse', 'gridhouse.mjs'); // copy of mapgen/gridhouse.mjs + builder.mjs + orient.mjs
const IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const LINE = 200; // characters per chat line
const MAX_TOOL_ROUNDS = 8;
// FCC maps model names to its slots (fable/opus/sonnet/haiku, anything else = MODEL); each slot is its own
// Gemini model and free-tier quota is per model, so a busy slot falls through to the next
const MODEL_FALLBACKS = ['claude-fable-5', 'claude-sonnet-5', 'claude-haiku-5', 'default'];
const LOG_FILE = path.join(__dirname, 'logs', 'chatbot.log');
const LOG_MAX = 5 * 1024 * 1024; // rotate to chatbot.log.1 past this size

// Brickadia units: 1 stud = 10 wide, 1 plate = 4 tall (a brick is 3 plates).
const STUD = 10;
const PLATE = 4;
// A standing player's position is about this far above the ground.
const FEET = 25;

const SHAPES = {
  brick: 'PB_DefaultBrick',
  tile: 'PB_DefaultTile',
  ramp: 'PB_DefaultRamp',
  wedge: 'PB_DefaultWedge',
  sidewedge: 'PB_DefaultSideWedge',
};
const MATERIALS = {
  plastic: 'BMC_Plastic',
  glow: 'BMC_Glow',
  glass: 'BMC_Glass',
  metal: 'BMC_Metallic',
  hologram: 'BMC_Hologram',
};
const FACING = { '+x': 0, '+y': 1, '-x': 2, '-y': 3 };

const BUILD_DOCS = `Coordinates are relative to the player who asked: they stand at x=0, y=0 and the ground under them is z=0.
x and y are in studs (horizontal), z and heights are in plates (vertical; 3 plates = 1 normal brick). A stud is as wide as 2.5 plates are tall.
Scale: a player is about 2 studs wide and 15 plates tall. A door is 4 studs wide and 18 plates tall. Rooms need walls at least 24 plates tall.
Start builds at least 6 studs away from the player (for example x=6 or more) so you don't bury them.

A build is a list of parts. The plugin turns each part into bricks, so you describe shapes, not single bricks:
- room: hollow walls with floor, door and glass windows. x,y = min corner, w,l = size (studs), z, h = wall height (plates). door: "-x", "+x", "-y" or "+y" (or a list, or "none"). windows: true/false. color, floor_color.
- roof: over a footprint. x,y,w,l the same as the room under it, z = top of the walls (room z + h). style: "pitched", "pyramid" or "flat". color. It overhangs by 1 stud on its own.
- tower: round. x,y = CENTER, radius (studs), z, h (plates). top: "battlements", "cone" or "flat". hollow: true/false. door side. color, roof_color.
- sphere: x,y = CENTER, z = bottom, radius (studs), optional rx, ry (studs), rz (plates, half the height). dome: true for the top half only. color.
- pyramid: x,y = min corner, w, l, z, step (plates per layer). color.
- stairs: x,y = start corner, z, steps, w = width (studs), facing = which way they climb ("+x" etc). color.
- tree: x,y = CENTER, z, h (plates), style "round" or "pine". leaf_color, trunk_color.
- box: one solid block. x,y = min corner, w, l, z, h. shape: brick, tile, ramp, wedge, sidewedge. facing for ramps/wedges; a ramp's facing is the side its slope climbs toward (its high end), so a ramp at x 10..14 with facing "+x" goes up from x 10 to x 14. Skate ramps, kickers and quarter pipes: high end against the wall/deck, low end toward the open floor. Use boxes for walls, floors, paths, fences, tables, towers of other shapes, anything else.
- extrude: a side-view drawing pushed out to a thickness. THE BEST PART FOR VEHICLES, ANIMALS, CHARACTERS, SIGNS, LETTERS, EMOJI, FURNITURE PROFILES. rows = list of strings, top row first, one character per pixel; palette = {"R":"#c02020","W":"#ffffff"} ("." and " " are empty). axis "x": the drawing runs along +x, thickness depth (studs) along +y from y. axis "y": it runs along +y, thickness along +x. px = studs per character (default 1), pz = plates per row (default 3, which makes square-ish pixels). Stack several extrudes of different depth/color for 3D (e.g. a car body depth 8, windows depth 6 at y+1, wheels as cylinders).
- layers: a full voxel model when shape matters from every side. layers = list of layers, bottom first; each layer is a list of strings (a string runs along +x, successive strings go along +y). palette, px, pz as in extrude.
- revolve: anything round (vases, bottles, rockets, mushrooms, snowmen, poop emoji, trunks, domes, fountains). x,y = center, z = bottom, radii = list of radii in studs from bottom to top, seg = plates per entry (default 3), colors = optional list of colors per entry, hollow = wall thickness (0 = solid).
- cylinder: x,y,z = center of the base; radius studs; axis "z" (upright, h plates) or "x"/"y" (lying on its side, h = length in studs, e.g. wheels, logs, pipes, barrels).
- line: a beam from x,y,z to x2,y2,z2 (studs, studs, plates), thickness studs. Legs, rails, poles, ropes, branches, antennas.
- carve: removes everything in a box that earlier parts made (doorways, windows, hollow insides, cutouts).
Parts are painted in order: later parts paint over earlier ones, so add details (windows, eyes, stripes, trim) after the body, and use carve to cut holes. Overlapping is fine and expected. The player looks along +x at the build, so put faces, fronts and signs on the side with the smallest x (an extrude with axis "y" at the front x paints a face onto a body).
Every part may set material: plastic, glow, glass, metal or hologram. Colors are hex like "#8b5a2b".

Quality is everything: players judge every build. Before the first build call, plan it: what the real thing looks like from the front, side and top; its real size on the grid (1 stud = 30 cm wide, 1 plate = 12 cm tall, a player is 1.8 m = 15 plates); its 3 to 6 main masses; the signature details that make it instantly recognizable; a palette with 2 or 3 shades per material (darker underneath and in recesses, lighter on top and on edges). Build big enough for detail: most builds 15 to 60 studs, small objects scaled up 2 to 4 times. A car is about 10 studs long and 5 wide at life size, a house 16+ studs, a statue or character 10 to 30 studs tall. Shape organic things with revolve, layers and extrude, never stacked boxes. Break up big flat walls and slabs with trim, frames, insets, panels, columns and stripes; add the small things (handles, lights, eyes, rivets, plants, signs, hubcaps). Everything rests on the ground or on something under it. Prefer extrude/layers/revolve for organic or detailed shapes and room/roof/tower for buildings. After a build, the tool result shows ASCII FRONT/SIDE/TOP previews with a color key: check it looks like the thing. If it clearly does not, call undo_build with "last" and build it again, fixed.
Example sports car (red, facing +x): [{"type":"extrude","x":6,"y":-3,"z":2,"axis":"x","depth":6,"pz":2,"palette":{"R":"#c01818","r":"#8a1010","G":"#9ad0ff","L":"#ffe080","T":"#ff4030"},"rows":["....GGGGG.....","...GGGGGGGR...","TRRRRRRRRRRRRL","rRRRRRRRRRRRRR","rrrrrrrrrrrrrr"]},{"type":"cylinder","axis":"y","x":9,"y":-4,"z":0,"radius":1.5,"h":8,"color":"#1a1a1a"},{"type":"cylinder","axis":"y","x":17,"y":-4,"z":0,"radius":1.5,"h":8,"color":"#1a1a1a"}]
Example snowman: [{"type":"revolve","x":10,"y":0,"z":0,"radii":[3,4,5,5,4,3,3,4,4,3,2,2,3,3,2],"color":"#f4f8ff"},{"type":"extrude","x":7,"y":-1,"z":38,"axis":"y","depth":1,"palette":{"K":"#111111","O":"#ff8020"},"rows":["K.K",".O."]}]

The plugin knows where bricks already stand. A build that would overlap existing bricks (other builds, player builds, hills) is moved to the nearest free spot and the tool result says where it went.
To add onto an existing build on purpose (a roof on a house, a second floor, furniture inside a room, a picture on a wall), place it with that build's position from the "Builds near" list and set allow_overlap true.
Compose big things from several parts and stack them with z. Aim for recognizable shapes with sensible colors and proportions. Examples:
house: [{"type":"room","x":6,"y":-8,"z":0,"w":16,"l":16,"h":27,"color":"#e8dcc0","door":"-x"},{"type":"roof","x":6,"y":-8,"z":27,"w":16,"l":16,"color":"#8b3a2a"}]
castle tower: [{"type":"tower","x":14,"y":0,"z":0,"radius":5,"h":90,"color":"#8a8a8a","top":"cone","roof_color":"#3050a0"}]
two-story house: a room with h 27, a box floor on top of it (h 1) and a second room at z 28, then a roof at z 55.
A sphere is about 5 plates tall per stud of radius, so stack spheres by that: snowman = spheres radius 5 at z 0, radius 4 at z 23, radius 3 at z 41.

Pictures: build_image puts a real image into the world, one brick per pixel, from a direct link to an image file (png, jpg, gif, webp) that a player gave.
It stands upright like a painting with its bottom edge centered on x,y (facing says which way the picture faces; "-x" faces a player at x=0 when it is at x>0), or lies on the ground with facing "flat".
width is in pixels (1 stud each, times pixel_size). visit_site reads a web page: a link a player gave, or a web search at https://www.bing.com/search?q=WORDS (then visit the best result). Its result lists the image links on the page, so to build a picture of something, search, visit a page about it and pass one of its image links to build_image. Never invent links.
For any house, home, cottage, cabin, mansion or building with rooms, call gridhouse, NOT build (build is for everything else). gridhouse builds a furnished-looking house from a floor plan drawn as text rows, one character per stud: Y = wall, R = room floor, G = door (in a wall), . = outside. Rooms are closed by walls (an open room edge gets a wall automatically), doors split rooms, each room gets its own floor, wallpaper and ceiling, windows and lap siding are added on outside walls. Walls are 1 character thick; always put a G front door in an outside wall, and G doors between rooms; make rooms at least 5x5 and give a house several rooms. It adds a pitched roof itself.`;

const SYSTEM = `You are a friendly assistant living in the chat of a Brickadia server (a multiplayer LEGO-like brick building game).
Each user message looks like "[renderman] hello": the name in brackets is the player talking. Several players share this conversation.
Replies appear in game chat, so:
- Keep answers short: one to three sentences unless someone asks for detail.
- Plain text only. No markdown, lists, headings, code blocks, or emoji codes.
- Never start a reply with a name and a colon; the chat already shows who you are. Only use names that appear in brackets.

You can build. When a player asks you to build, place, or make something, call the build tool. Do not ask clarifying questions about builds: pick something reasonable and build it.

${BUILD_DOCS}

Every build call first comes back as a DRAFT with a rendered picture of it, not placed yet: review the picture honestly and call build again with the improved complete build; after the reviews the plugin places it. Aim for the best build you can make, not the first one that works. Once it is placed, reply with one short sentence about what you made. Use undo_build only for builds that are really in the world: when a player asks, or to fix a placed build.
When a player complains about a build (wrong, ugly, broken, backwards), FIX it: undo_build "last" and then call build with the corrected version in the same turn. Never just remove a build unless the player asked to remove or delete it. Never reply "rebuilding" or "on it" without calling build in that same answer.
"Large", "massive", "huge" means big and full: dozens of parts, 60+ studs across, with real detail.
Never say you built or removed something unless you called the tool for it in this turn and it succeeded. If you did not call the tool, you did not build anything.
The server also has a terrain plugin: "!terrain" grows a landscape with house plots next to the host, "!terrain clear" removes it.`;

const TOOLS = [
  {
    name: 'build',
    description:
      'Build something next to the player who asked, from parts (room, roof, tower, sphere, pyramid, stairs, tree, box, extrude, layers, revolve, cylinder, line, carve). Coordinates are relative to that player: x,y in studs, z and heights in plates above their ground. See the system prompt for each part\'s fields.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short name of what is being built, e.g. "small house"' },
        parts: {
          type: 'array',
          description: 'Parts to build',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: shapes.PARTS },
              x: { type: 'number' },
              y: { type: 'number' },
              z: { type: 'number', description: 'plates above ground' },
              w: { type: 'number', description: 'studs along x' },
              l: { type: 'number', description: 'studs along y' },
              h: { type: 'number', description: 'plates tall' },
              radius: { type: 'number', description: 'studs (tower, sphere, tree canopy)' },
              rx: { type: 'number' },
              ry: { type: 'number' },
              rz: { type: 'number', description: 'plates' },
              color: { type: 'string', description: 'hex like "#ff0000"' },
              material: { type: 'string', enum: Object.keys(MATERIALS) },
              shape: { type: 'string', enum: Object.keys(SHAPES), description: 'box only' },
              facing: { type: 'string', enum: Object.keys(FACING), description: 'box ramps/wedges, stairs' },
              style: { type: 'string', description: 'roof: pitched/pyramid/flat; tree: round/pine' },
              top: { type: 'string', enum: ['battlements', 'cone', 'flat', 'none'], description: 'tower' },
              door: { description: 'room/tower door side(s): -x, +x, -y, +y or none' },
              windows: { type: 'boolean', description: 'room' },
              hollow: { type: 'boolean', description: 'tower' },
              dome: { type: 'boolean', description: 'sphere: top half only' },
              steps: { type: 'number', description: 'stairs' },
              step: { type: 'number', description: 'roof/pyramid plates per layer' },
              floor_color: { type: 'string' },
              roof_color: { type: 'string' },
              leaf_color: { type: 'string' },
              trunk_color: { type: 'string' },
              rows: { type: 'array', items: { type: 'string' }, description: 'extrude: drawing, top row first' },
              layers: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'layers: voxel layers, bottom first' },
              palette: { type: 'object', description: 'extrude/layers: character -> color' },
              axis: { type: 'string', enum: ['x', 'y', 'z'], description: 'extrude: x or y; cylinder: x, y or z' },
              depth: { type: 'number', description: 'extrude: thickness in studs' },
              px: { type: 'number', description: 'extrude/layers: studs per character' },
              pz: { type: 'number', description: 'extrude/layers: plates per row/layer' },
              radii: { type: 'array', items: { type: 'number' }, description: 'revolve: radii bottom to top (studs)' },
              colors: { type: 'array', items: { type: 'string' }, description: 'revolve: color per radius' },
              seg: { type: 'number', description: 'revolve: plates per radius' },
              x2: { type: 'number' },
              y2: { type: 'number' },
              z2: { type: 'number' },
              thickness: { type: 'number', description: 'line: studs' },
            },
            required: ['type', 'x', 'y', 'z'],
          },
        },
        allow_overlap: { type: 'boolean', description: 'true only when this is meant to join onto or go inside an existing build (a roof on a house, furniture in a room); otherwise an overlapping build is moved to free space' },
        final: { type: 'boolean', description: 'true = place it now: only when a draft you reviewed is already excellent' },
      },
      required: ['parts'],
    },
  },
  {
    name: 'undo_build',
    description: 'Remove bricks you built earlier: "last" removes the newest build made for the asking player (or the newest overall if they have none), "all" removes every build.',
    input_schema: {
      type: 'object',
      properties: { which: { type: 'string', enum: ['last', 'all'] } },
      required: ['which'],
    },
  },
  {
    name: 'build_image',
    description:
      'Build a real picture from an image link a player gave, one brick per pixel, next to the player who asked. Coordinates are relative to that player like build. Undo it with undo_build.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'direct http(s) link to a png, jpg, gif or webp image' },
        name: { type: 'string', description: 'short name, e.g. "renderman picture"' },
        x: { type: 'number', description: 'studs; center of the bottom edge (default 12)' },
        y: { type: 'number', description: 'studs (default 0)' },
        z: { type: 'number', description: 'plates above ground (default 0)' },
        width: { type: 'number', description: 'picture width in pixels, default 64' },
        pixel_size: { type: 'number', description: 'studs per pixel, 1 to 8, default 1' },
        facing: { type: 'string', enum: ['-x', '+x', '-y', '+y', 'flat'], description: 'which way the picture faces, or flat on the ground; default -x' },
        glow: { type: 'boolean', description: 'make the picture glow' },
        allow_overlap: { type: 'boolean', description: 'true to hang it on or put it into an existing build on purpose' },
      },
      required: ['url'],
    },
  },
  {
    name: 'visit_site',
    description: 'Read a web page: returns its title, text, links and image links. For a web search visit https://www.bing.com/search?q=WORDS.',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'http(s) link' } },
      required: ['url'],
    },
  },
  {
    name: 'gridhouse',
    description: 'Build a house with interior finishes from a text floor plan (Y wall, R room, G door, . outside; one character per stud) next to the player who asked. Undo it with undo_build.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'short name, e.g. "cottage"' },
        rows: { type: 'array', items: { type: 'string' }, description: 'plan rows, all the same length; rows[0] is the low-y side, character 0 the low-x side' },
        x: { type: 'number', description: 'studs; low-x corner of the plan (default 3)' },
        y: { type: 'number', description: 'studs; low-y corner of the plan (default 0)' },
        roof_color: { type: 'string', description: 'hex, default "#8b3a2a"' },
        allow_overlap: { type: 'boolean', description: 'true to put it into an existing build on purpose' },
      },
      required: ['rows'],
    },
  },
];

const agentSystem = maxSteps => `You are an agent on a Brickadia server (a multiplayer LEGO-like brick building game). A player gave you a task. Work on it step by step with your tools until it is done, then call finish with a one or two sentence summary.
- Each step you may call one or more tools and you see their results before the next step. You have at most ${maxSteps} steps, so do big builds as a few large build calls, not many small ones.
- Use list_players to see who is online and where they are. The build tool builds next to the player named in "near" (default: the player who gave the task), and coordinates are relative to that player.
- Use say for short progress updates everyone can see, only when it helps (not every step).
- Plain text only in say and finish, no markdown. Do not ask questions: make reasonable choices yourself.
- You cannot run server commands, kick, ban, teleport players or remove bricks you did not build. If the task needs that, explain it in finish.
- The task message looks like "[renderman] Task: ...": the name in brackets is the player who gave it.

You build with parts:
${BUILD_DOCS}`;

const AGENT_TOOLS = [
  {
    ...TOOLS[0],
    description:
      'Build something next to a player, from parts (room, roof, tower, sphere, pyramid, stairs, tree, box, extrude, layers, revolve, cylinder, line, carve). Coordinates are relative to the player in "near": x,y in studs, z and heights in plates above their ground.',
    input_schema: {
      ...TOOLS[0].input_schema,
      properties: {
        ...TOOLS[0].input_schema.properties,
        near: { type: 'string', description: 'player name to build next to; default the player who gave the task' },
      },
    },
  },
  TOOLS[1],
  {
    ...TOOLS[2],
    input_schema: {
      ...TOOLS[2].input_schema,
      properties: {
        ...TOOLS[2].input_schema.properties,
        near: { type: 'string', description: 'player name to build next to; default the player who gave the task' },
      },
    },
  },
  TOOLS[3],
  {
    name: 'list_players',
    description: 'List online players with their positions relative to the player who gave the task (studs, and plates for height).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_builds',
    description: 'List the builds you (the AI) have made that are still standing, newest last.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'say',
    description: 'Post a short message in server chat that everyone sees.',
    input_schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
  },
  {
    name: 'finish',
    description: 'End the task. The summary is posted in chat.',
    input_schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
  },
];

// Omegga's chat sanitizer, so model output can't inject chat markup.
const sanitize = str =>
  str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '&scl;')
    .replace(/>/g, '&gt;')
    .replace(/_/g, '&und;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '\\"');

/** Flatten markdown-ish model output and split it into chat-sized lines. */
function toChatLines(text) {
  const flat = text
    .replace(/```[\s\S]*?```/g, m => m.replace(/```\w*/g, ''))
    .replace(/\*\*|__|`|^#+\s*/gm, '')
    .replace(/\s*\n+\s*/g, ' ')
    .trim();
  const lines = [];
  let rest = flat;
  while (rest.length > LINE) {
    let cut = rest.lastIndexOf(' ', LINE);
    if (cut < LINE / 2) cut = LINE;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) lines.push(rest);
  return lines;
}

/** One-line chat summary of a tool call, e.g. 'building "house": room, roof'. */
function describeTool(tool, input) {
  if (tool === 'undo_build') return input.which === 'all' ? 'removing all AI builds...' : 'removing the last AI build...';
  if (tool === 'build_image') return `downloading and converting picture "${input.name || 'image'}"...`;
  if (tool === 'gridhouse') return `drawing up house "${input.name || 'house'}" from a ${input.rows?.length ?? 0}-row plan...`;
  if (tool === 'visit_site') return `visiting ${String(input.url ?? '').slice(0, 120)}...`;
  if (tool !== 'build') return `running ${tool}...`;
  const parts = Array.isArray(input.parts) ? input.parts : Array.isArray(input.bricks) ? input.bricks : [];
  const counts = {};
  for (const p of parts) counts[p.type ?? 'box'] = (counts[p.type ?? 'box'] ?? 0) + 1;
  const list = Object.entries(counts).map(([t, n]) => (n > 1 ? `${n} ${t}${t.endsWith('x') ? 'es' : 's'}` : t)).join(', ');
  return `building "${input.name || 'something'}" from ${list || 'nothing'}...`;
}

/** Drop a leading "name:" or "[name]" the model sometimes copies from the prompt format. */
const stripSpeaker = text => text.replace(/^\s*(\[[^\]\n]{1,32}\]|[^\s:\[\]]{1,32}:)\s*/u, '');

function parseColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) return [200, 200, 200];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// a reply that promises a build it did not make
const PROMISE = /\b(re-?build(ing)? (it|that|now|the)|building (it|that) now|i'?ll (build|make|fix|redo|rebuild)|i will (build|make|fix|rebuild)|let me (build|make|fix|redo|rebuild)|on it|fixing (it|that)|working on it)\b/i;
// player messages that do ask for removal
const REMOVE = /\b(remove|delete|undo|clear|get rid|destroy|take (it|that) (down|away))\b/i;

/** Mixed-script word salad from a degenerating model. */
function isGibberish(s) {
  const scripts = new Set();
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x80) continue;
    scripts.add(c >= 0x4e00 && c <= 0x9fff ? 'han' : c >= 0x400 && c <= 0x4ff ? 'cyr' : c >= 0x590 && c <= 0x6ff ? 'rtl'
      : c >= 0x900 && c <= 0xdff ? 'indic' : c >= 0x3040 && c <= 0x30ff ? 'kana' : c >= 0xac00 && c <= 0xd7af ? 'hangul'
      : c >= 0xfff0 ? 'bad' : c >= 0x2000 ? 'sym' : 'latin');
  }
  const odd = [...s].filter(ch => ch.codePointAt(0) >= 0x80).length;
  return scripts.has('bad') || scripts.size >= 3 || (scripts.size >= 2 && odd > s.length * 0.2) || /[\t]|_[a-z]+[A-Z]|\.\w+\(|####/.test(s) && odd > 3;
}

const num = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};

/** Model brick spec (studs/plates, min corner) -> legacy save brick (units, center). */
function toSaveBrick(b, limit) {
  const w = num(b.w, 1, 128, 1);
  const l = num(b.l, 1, 128, 1);
  const h = num(b.h, 1, 256, 3);
  const x = num(b.x, -limit, limit, 0);
  const y = num(b.y, -limit, limit, 0);
  const z = num(b.z, 0, 1000, 0);
  // PB_DefaultRamp at rotation 0 rises toward -x (measured, mapgen caves);
  // for ramps facing = the side the slope climbs toward
  const rotation = ((FACING[b.facing] ?? 0) + (b.shape === 'ramp' ? 2 : 0)) % 4;
  // Size is in the brick's own frame, so odd rotations swap the footprint.
  const [sx, sy] = rotation % 2 ? [l, w] : [w, l];
  const [r, g, bl] = parseColor(b.color);
  const material = MATERIALS[b.material] ?? 'BMC_Plastic';
  return {
    asset: SHAPES[b.shape] ?? 'PB_DefaultBrick',
    material,
    ...(material === 'BMC_Glow' ? { material_intensity: 5 } : {}),
    size: [(sx * STUD) / 2, (sy * STUD) / 2, (h * PLATE) / 2],
    position: [(x + w / 2) * STUD, (y + l / 2) * STUD, (z + h / 2) * PLATE],
    direction: 4, // Z_Positive
    rotation,
    // brs-js writes these as sRGB R,G,B as-is. (The terrain plugin swaps red
    // and blue, but in-game builds from here came out swapped with that.)
    color: [r, g, bl],
  };
}

function toLegacySave(bricks, owner) {
  const assets = [], materials = [];
  const index = (list, name) => {
    let i = list.indexOf(name);
    if (i === -1) i = list.push(name) - 1;
    return i;
  };
  return {
    brick_assets: assets,
    materials,
    brick_owners: [{ ...owner, bricks: bricks.length }],
    bricks: bricks.map(({ asset, material, ...b }) => ({
      ...b,
      asset_name_index: index(assets, asset),
      material_index: index(materials, material),
      owner_index: 1,
    })),
  };
}

/** Run a program, resolve with stdout, reject with the last line of stderr. */
const run = (cmd, args, timeout = 60_000) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout, maxBuffer: 4 << 20 }, (err, stdout, stderr) => {
      if (!err) return resolve(stdout);
      const why = String(stderr || '').trim().split('\n').pop() || err.message;
      reject(new Error(`${path.basename(cmd)} failed: ${why}`));
    })
  );

const PAGE_MAX_BYTES = 3 * 1024 * 1024;
const PAGE_TEXT = 6000; // characters of page text handed to the model

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : named[e.toLowerCase()] ?? m);
}

/** Drop scripts, styles and menus from HTML. */
function stripMenus(html) {
  return html
    .replace(/<(script|style|noscript|svg|head|nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ')
    // lists that are nearly all links are menus (language pickers, sidebars)
    .replace(/<ul\b[\s\S]*?<\/ul>/gi, ul => {
      const all = ul.replace(/<[^>]+>/g, '').trim().length;
      const linked = [...ul.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].reduce((n, m) => n + m[1].replace(/<[^>]+>/g, '').trim().length, 0);
      return all && linked / all > 0.8 ? ' ' : ul;
    });
}

/** HTML to readable text: tags out, block breaks kept. */
function htmlText(html) {
  return decodeEntities(
    html
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/[ \t\r\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

/** Loopback, LAN and link-local addresses, so image links can't reach the server's network. */
function isPrivateAddress(ip) {
  if (net.isIPv6(ip)) {
    const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (v4) return isPrivateAddress(v4[1]);
    return /^(::1?$|f[cd]|fe[89ab])/i.test(ip);
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b < 128) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || a >= 224;
}

// Which way "right" runs along a standing picture, by the side it faces.
const PICTURE_RIGHT = { '-x': [0, 1], '+x': [0, -1], '-y': [-1, 0], '+y': [1, 0] };

/**
 * heightmap2brz --img bricks (a flat picture, pixel columns along +x, rows
 * along +y) -> save bricks for a picture standing (or lying, facing "flat")
 * with its bottom edge centered on x,y,z (studs, studs, plates).
 */
function pictureToSave(reader, { x, y, z, scale, facing, glow }) {
  const assets = reader.brickAssets();
  const materials = reader.materials();
  const bricks = [...reader.bricks()];
  if (!bricks.length) throw new Error('the picture came out empty (is it fully transparent?)');
  const minX = Math.min(...bricks.map(b => b.position[0] - b.size[0]));
  const minY = Math.min(...bricks.map(b => b.position[1] - b.size[1]));
  const maxX = Math.max(...bricks.map(b => b.position[0] + b.size[0]));
  const maxY = Math.max(...bricks.map(b => b.position[1] + b.size[1]));
  const width = (maxX - minX) * scale, height = (maxY - minY) * scale;
  const ox = x * STUD, oy = y * STUD, oz = z * PLATE;
  const save = bricks.map(b => {
    // u runs left to right, v top to bottom, both from the picture's corner
    const u = (b.position[0] - minX) * scale - width / 2;
    const v = (b.position[1] - minY) * scale;
    const du = b.size[0] * scale, dv = b.size[1] * scale;
    let position, size;
    if (facing === 'flat') {
      position = [ox + u, oy + v - height / 2, oz + 2];
      size = [du, dv, 2];
    } else {
      const [rx, ry] = PICTURE_RIGHT[facing] ?? PICTURE_RIGHT['-x'];
      position = [ox + rx * u, oy + ry * u, oz + height - v];
      size = rx ? [du, 2, dv] : [2, du, dv];
    }
    const material = glow ? 'BMC_Glow' : materials[b.material_index] ?? 'BMC_Plastic';
    return {
      asset: assets[b.asset_name_index] ?? 'PB_DefaultBrick',
      material,
      material_intensity: glow ? 2 : b.material_intensity ?? 5,
      size,
      position,
      direction: 4,
      rotation: 0,
      color: b.color.slice(0, 3),
    };
  });
  return { save, width: (maxX - minX) / STUD, height: (maxY - minY) / STUD };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** World box {min, max} (units) of one save brick placed at an origin. Odd rotations swap the footprint. */
function brickBox(b, [ox, oy, oz]) {
  const [sx, sy] = b.rotation % 2 ? [b.size[1], b.size[0]] : [b.size[0], b.size[1]];
  const s = [sx, sy, b.size[2]], o = [ox, oy, oz];
  return { min: [0, 1, 2].map(i => o[i] + b.position[i] - s[i]), max: [0, 1, 2].map(i => o[i] + b.position[i] + s[i]) };
}

function unionBox(boxes) {
  return {
    min: [0, 1, 2].map(i => Math.min(...boxes.map(b => b.min[i]))),
    max: [0, 1, 2].map(i => Math.max(...boxes.map(b => b.max[i]))),
  };
}

// Touching faces (a roof sitting on walls) don't count, only real overlap.
const overlaps = (a, b, pad = 1) => [0, 1, 2].every(i => a.min[i] + pad < b.max[i] && b.min[i] + pad < a.max[i]);
const moveBox = (box, dx, dy) => ({ min: [box.min[0] + dx, box.min[1] + dy, box.min[2]], max: [box.max[0] + dx, box.max[1] + dy, box.max[2]] });

/** First file under dir (two levels deep) whose name starts with prefix. */
function findFile(dir, prefix) {
  for (const sub of ['', ...(() => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch { return []; } })()]) {
    try {
      const hit = fs.readdirSync(path.join(dir, sub)).find(f => f.startsWith(prefix));
      if (hit) return path.join(dir, sub, hit);
    } catch {}
  }
  return null;
}

/** "4.3/5 (3 votes)" for a ticket record */
function ratingText(t) {
  const v = Object.values(t.votes ?? {});
  return v.length ? `${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}/5 (${v.length} vote${v.length === 1 ? '' : 's'})` : 'not rated yet';
}

// Loading words (owner 2026-10-16: "make all loading... text say felching... scromiting... munting... gooning... and other ones")
const LOADING = ['Felching', 'Scromiting', 'Munting', 'Gooning', 'Schlorping', 'Flonking', 'Gronking', 'Boofing', 'Scrungling', 'Blorbing',
  'Squonking', 'Crunkling', 'Jorking', 'Yeeting', 'Smooshing', 'Honking', 'Slurping', 'Bonking', 'Noodling', 'Goblining',
  'Discombobulating', 'Frobnicating', 'Bamboozling', 'Hornswoggling', 'Lollygagging', 'Skedaddling', 'Kerfuffling', 'Gallumphing',
  'Flibbertigibbeting', 'Shenaniganing', 'Spelunking', 'Schmoozing', 'Dilly-dallying', 'Wrangling', 'Brapping', 'Snorkeling'];
const loading = () => LOADING[Math.floor(Math.random() * LOADING.length)];

module.exports = class Plugin {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.history = [];
    this.lastUse = new Map();
    this.modelDown = new Map(); // model name -> time its quota/overload pause ends
    // Running requests. !ai, !agent and !img requests all run side by side,
    // several per player too; only the total is capped (max-parallel).
    this.jobs = new Set();
    this.queue = []; // tickets waiting for a slot: { job, resolve }
    // the ticket of the request running in the current async context, for [AI][#n] chat tags
    this.current = new AsyncLocalStorage();
    this.ticketsLock = Promise.resolve();
    this.buildsLock = Promise.resolve();
    // World boxes of standing AI builds by owner id, kept in memory so
    // placing a build can check and claim space without awaiting the store.
    this.boxes = new Map();
  }

  // ------------------------------------------------------------ tickets --
  // Every !ai / !agent / !img request takes a numbered ticket. Up to
  // max-parallel run at once; the rest wait in line (deli-counter style) and
  // start in ticket order. Finished tickets are kept (store 'tickets') so
  // players can rate what was built.

  /** Take a ticket and wait for a slot. Resolves to the job, or null if the ticket was cancelled while waiting. */
  async startJob(name, kind, text = '') {
    // A job that outlived the longest agent run leaked from a crash; free its slot.
    const stale = Date.now() - ((this.config['agent-max-minutes'] ?? 10) + 5) * 60_000;
    for (const j of this.jobs) if (j.started < stale) this.jobs.delete(j);
    const open = [...this.jobs].filter(j => j.by === name).length + this.queue.filter(q => q.job.by === name).length;
    const cap = this.config['max-tickets-per-player'] ?? 3;
    if (open >= cap) {
      this.whisper(name, `You already have ${open} open tickets (max ${cap}). Wait for one to finish, or !cancel one.`);
      return null;
    }
    const n = ((await this.store.get('ticketNo')) ?? 0) + 1;
    await this.store.set('ticketNo', n);
    const job = { ticket: n, kind, by: name, text: String(text).slice(0, 80), cancelled: false, queued: Date.now(), started: null, built: 0 };
    await this.updateTickets(list => { list.push({ n, by: name, kind, text: job.text, at: Date.now(), status: 'waiting', built: 0, votes: {} }); });
    const max = this.config['max-parallel'] ?? 6;
    if (this.jobs.size < max && !this.queue.length) {
      this.broadcast(`<color="999"><b>[${sanitize(this.config['bot-name'] || 'AI')}]</> Ticket <b>#${n}</> (${sanitize(name)}) - working on it now.</>`);
      return this.run(job);
    }
    this.broadcast(`<color="999"><b>[${sanitize(this.config['bot-name'] || 'AI')}]</> Ticket <b>#${n}</> (${sanitize(name)}) - ${this.queue.length} waiting ahead (${this.jobs.size} being built now). !ticket to check, !cancel to drop it.</>`);
    this.log('ticket', `#${n} ${name} queued (${this.queue.length} waiting)`);
    return new Promise(resolve => this.queue.push({ job, resolve }));
  }

  run(job) {
    job.started = Date.now();
    this.jobs.add(job);
    this.updateTickets(list => { const t = list.find(t => t.n === job.ticket); if (t) t.status = 'working'; }).catch(() => {});
    return job;
  }

  endJob(job) {
    if (!this.jobs.delete(job)) return;
    const status = job.cancelled ? 'cancelled' : job.failed ? 'failed' : 'done';
    this.updateTickets(list => {
      const t = list.find(t => t.n === job.ticket);
      if (t) Object.assign(t, { status, built: job.built, secs: Math.round((Date.now() - job.started) / 1000) });
    }).catch(() => {});
    if (job.built && status === 'done')
      this.broadcast(`<color="999"><b>[${sanitize(this.config['bot-name'] || 'AI')}]</> Ticket #${job.ticket} done. Rate ${sanitize(job.by)}'s build: <b>!rate 1-5</> (or !rate 1-5 ${job.ticket})</>`);
    // next in line
    const max = this.config['max-parallel'] ?? 6;
    while (this.queue.length && this.jobs.size < max) {
      const { job: next, resolve } = this.queue.shift();
      this.broadcast(`<color="999"><b>[${sanitize(this.config['bot-name'] || 'AI')}]</> Now serving ticket #${next.ticket} (${sanitize(next.by)})</>`);
      resolve(this.run(next));
    }
  }

  updateTickets(fn) {
    const next = this.ticketsLock.then(async () => {
      const list = (await this.store.get('tickets')) ?? [];
      const out = await fn(list);
      await this.store.set('tickets', list.slice(-300));
      return out;
    });
    this.ticketsLock = next.catch(() => {});
    return next;
  }

  /** !ticket: your tickets and place in line. */
  async ticketCommand(name) {
    const running = [...this.jobs].filter(j => j.by === name);
    const lines = running.map(j => `#${j.ticket} (${j.kind}) is being worked on, ${Math.round((Date.now() - j.started) / 1000)}s so far.`);
    this.queue.forEach((q, i) => { if (q.job.by === name) lines.push(`#${q.job.ticket} (${q.job.kind}) is waiting, ${i} ahead of it.`); });
    if (!lines.length) {
      const last = ((await this.store.get('tickets')) ?? []).filter(t => t.by === name).at(-1);
      lines.push(last ? `No open tickets. Your last was #${last.n}: ${last.status}${last.built ? `, ${ratingText(last)}` : ''}.` : 'You have no tickets. Use !ai, !agent or !img to make a request.');
    }
    for (const l of lines) this.whisper(name, sanitize(l));
  }

  /** !tickets: the counter - who is being served and who is waiting. */
  async ticketsCommand(name) {
    const no = (await this.store.get('ticketNo')) ?? 0;
    this.whisper(name, `<b>Ticket counter</> - last ticket #${no}, ${this.jobs.size} being served, ${this.queue.length} waiting.`);
    for (const j of this.jobs) this.whisper(name, sanitize(`serving #${j.ticket} ${j.by} (${j.kind}): ${j.text}`));
    for (const q of this.queue.slice(0, 8)) this.whisper(name, sanitize(`waiting #${q.job.ticket} ${q.job.by} (${q.job.kind}): ${q.job.text}`));
  }

  /** !cancel [#]: drop your waiting ticket (or stop your running agent). */
  async cancelCommand(name, arg) {
    const n = Number(String(arg ?? '').replace('#', '')) || null;
    const isHost = this.omegga.getPlayer(name)?.isHost();
    const i = this.queue.findIndex(q => (n ? q.job.ticket === n : q.job.by === name));
    if (i >= 0) {
      const { job, resolve } = this.queue[i];
      if (job.by !== name && !isHost) return this.whisper(name, 'That is not your ticket.');
      this.queue.splice(i, 1);
      await this.updateTickets(list => { const t = list.find(t => t.n === job.ticket); if (t) t.status = 'cancelled'; });
      resolve(null);
      return this.whisper(name, `Ticket #${job.ticket} cancelled.`);
    }
    const run = [...this.jobs].find(j => (n ? j.ticket === n : j.by === name));
    if (!run) return this.whisper(name, n ? `Ticket #${n} is not open.` : 'You have no open tickets.');
    if (run.by !== name && !isHost) return this.whisper(name, 'That is not your ticket.');
    run.cancelled = true;
    this.whisper(name, run.kind === 'agent' ? `Ticket #${run.ticket} will stop after its current step.` : `Ticket #${run.ticket} is already being built; it can't be stopped halfway (use !ai undo after).`);
  }

  /** !rate 1-5 [#]: rate a finished build (default: the newest one). One vote per player per ticket. */
  async rateCommand(name, args) {
    const [score, which] = args;
    const s = Number(score);
    if (!Number.isInteger(s) || s < 1 || s > 5) return this.whisper(name, 'Usage: !rate 1-5 [ticket number]   (5 is best)');
    const n = Number(String(which ?? '').replace('#', '')) || null;
    const res = await this.updateTickets(list => {
      const t = n ? list.find(t => t.n === n) : list.filter(t => t.built && t.status === 'done').at(-1);
      if (!t || !t.built) return n ? `Ticket #${n} has no build to rate.` : 'There is no build to rate yet.';
      if (t.by === name && !(this.config['rate-own'] ?? false)) return `You can't rate your own build (#${t.n}).`;
      t.votes = t.votes ?? {};
      t.votes[name] = s;
      return t;
    });
    if (typeof res === 'string') return this.whisper(name, res);
    this.log('rate', `${name} rated #${res.n} (${res.by}) ${s}`);
    this.broadcast(`<color="999"><b>[${sanitize(this.config['bot-name'] || 'AI')}]</> ${sanitize(name)} rated #${res.n} ${'*'.repeat(s)} - ${sanitize(ratingText(res))}</>`);
  }

  /** !ratings: overall score and the best and latest rated builds. */
  async ratingsCommand(name) {
    const rated = ((await this.store.get('tickets')) ?? []).filter(t => t.votes && Object.keys(t.votes).length);
    if (!rated.length) return this.whisper(name, 'No builds have been rated yet. Rate the newest one with !rate 1-5.');
    const all = rated.flatMap(t => Object.values(t.votes));
    this.whisper(name, `<b>AI build ratings</> - ${(all.reduce((a, b) => a + b, 0) / all.length).toFixed(2)}/5 from ${all.length} votes on ${rated.length} builds.`);
    const avg = t => Object.values(t.votes).reduce((a, b) => a + b, 0) / Object.values(t.votes).length;
    const best = [...rated].sort((a, b) => avg(b) - avg(a)).slice(0, 3);
    for (const t of best) this.whisper(name, sanitize(`best #${t.n} ${t.by}: "${t.text}" - ${ratingText(t)}`));
    for (const t of rated.slice(-3).reverse()) this.whisper(name, sanitize(`recent #${t.n} ${t.by}: "${t.text}" - ${ratingText(t)}`));
  }

  /** !kill: kill yourself (stuck, fell in a hole); the host can !kill <player>. */
  killCommand(name, who) {
    let target = name;
    if (who) {
      if (!this.omegga.getPlayer(name)?.isHost()) return this.whisper(name, 'Only the host can kill other players. !kill on its own kills you.');
      const p = this.findPlayer(who);
      if (!p) return this.whisper(name, `No online player matches "${sanitize(who)}".`);
      target = p.name;
    }
    // Omegga's player.kill() still sends the pre-rename Server.Players.Kill
    this.omegga.writeln(`br.Server.Players.Kill "${target.replace(/"/g, '')}"`);
    this.log('kill', `${name} killed ${target}`);
  }

  /** /help: how to use the AI. */
  helpCommand(name) {
    const bot = sanitize(this.config['bot-name'] || 'AI');
    [
      `<b><color="8cf">${bot} help</></>`,
      ...(AI_HIDDEN ? [] : [
        '<b>!ai</> message - chat, or ask for a build: "!ai build a red castle with towers". "!ai undo" removes your last build, "!ai reset" stops everything and clears my memory.',
      ]),
      '<b>!agent</> task - a bigger multi-step job, e.g. "!agent build a village of 5 houses". "!agent stop" stops yours.',
      '<b>!img</> image-link [width] [pixel size] [flat] [glow] - turns a picture into bricks.',
      '<b>Tickets</> - every request gets a number and waits its turn. <b>!ticket</> your tickets, <b>!tickets</> the whole counter, <b>!cancel</> [#] drops a waiting one.',
      '<b>!kill</> - respawn yourself if you are stuck.',
      '<b>Ratings</> - <b>!rate 1-5</> [#] rates the newest build (or ticket #), <b>!ratings</> shows the scores.',
      'Builds appear next to you, so stand somewhere with room. Big detailed requests work best: say the size, colors and style.',
    ].forEach(l => this.whisper(name, l));
  }

  /** Read-modify-write the stored build list one caller at a time, so parallel builds don't drop each other. */
  updateBuilds(fn) {
    const next = this.buildsLock.then(async () => {
      const builds = (await this.store.get('builds')) ?? [];
      const out = await fn(builds);
      await this.store.set('builds', builds);
      return out;
    });
    this.buildsLock = next.catch(() => {});
    return next;
  }

  /**
   * Run one model turn's tool calls side by side (they are independent
   * builds, lookups and messages). undo_build depends on what was built
   * before it, so a turn that undoes anything runs in order instead.
   */
  async runTools(uses, each) {
    if (uses.some(u => u.name === 'undo_build')) {
      const out = [];
      for (const use of uses) out.push(await each(use));
      return out;
    }
    return Promise.all(uses.map(each));
  }

  async init() {
    const baseURL = this.config['base-url'] || 'http://127.0.0.1:8083';
    this.client = new Anthropic({
      baseURL,
      apiKey: this.config['proxy-token'] || 'freecc',
      timeout: 240_000,
      maxRetries: 1,
    });
    this.baseURL = baseURL;
    this.brs = await import(pathToFileURL(path.join(__dirname, 'lib/brs.mjs')).href);
    // Saved/Builds sits next to Saved/Prefabs
    this.prefabDir = path.join(path.dirname(this.omegga.savePath), 'Prefabs');
    for (const b of (await this.store.get('builds')) ?? []) if (b.box) this.boxes.set(b.id, { name: b.name, by: b.by, box: b.box });
    fs.mkdirSync(this.prefabDir, { recursive: true });

    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    this.log('start', `plugin loaded, proxy ${baseURL}, model ${this.config.model || 'claude-opus-5'}`);

    this.handler = (name, ...args) =>
      this.command(name, args.join(' ').trim()).catch(err => {
        this.log('error', `${name}: unhandled ${err.stack ?? err}`);
      });
    // Unsafe plugins share Omegga's event emitter, so handlers from earlier
    // loads of this plugin would otherwise keep firing after a reload.
    for (const e of EVENTS) {
      this.omegga.removeAllListeners(e);
      if (!AI_HIDDEN) this.omegga.on(e, this.handler);
    }
    this.agentHandler = (name, ...args) =>
      this.agentCommand(name, args.join(' ').trim()).catch(err => {
        this.log('error', `${name}: unhandled agent ${err.stack ?? err}`);
      });
    for (const e of AGENT_EVENTS) {
      this.omegga.removeAllListeners(e);
      this.omegga.on(e, this.agentHandler);
    }
    this.imageHandler = (name, ...args) =>
      this.imageCommand(name, args).catch(err => {
        this.log('error', `${name}: unhandled image ${err.stack ?? err}`);
      });
    for (const e of IMAGE_EVENTS) {
      this.omegga.removeAllListeners(e);
      this.omegga.on(e, this.imageHandler);
    }
    // tickets, ratings and help: "!x" and "/x"
    this.extra = {
      ticket: name => this.ticketCommand(name),
      tickets: name => this.ticketsCommand(name),
      cancel: (name, ...a) => this.cancelCommand(name, a[0]),
      rate: (name, ...a) => this.rateCommand(name, a),
      ratings: name => this.ratingsCommand(name),
      help: name => this.helpCommand(name),
      aihelp: name => this.helpCommand(name),
      kill: (name, ...a) => this.killCommand(name, a.join(' ').trim()),
    };
    this.extraHandlers = [];
    for (const [cmd, fn] of Object.entries(this.extra))
      for (const e of [`chatcmd:${cmd}`, `cmd:${cmd}`]) {
        // !help belongs to Omegga's own plugin help; only take /help
        if (e === 'chatcmd:help') continue;
        const h = (name, ...args) => Promise.resolve(fn(name, ...args)).catch(err => this.log('error', `${name}: ${cmd} ${err.stack ?? err}`));
        this.omegga.removeAllListeners(e);
        this.omegga.on(e, h);
        this.extraHandlers.push([e, h]);
      }
    if (!fs.existsSync(HEIGHTMAP)) this.log('error', `${HEIGHTMAP} is missing, so pictures will not work`);
    return { registeredCommands: [...(AI_HIDDEN ? [] : ['ai']), 'agent', 'img', 'image', 'ticket', 'tickets', 'cancel', 'rate', 'ratings', 'help', 'aihelp', 'kill'] };
  }

  /** One line per event in logs/chatbot.log, also echoed to Omegga's console. */
  log(kind, text) {
    const line = `${new Date().toISOString()} ${kind.padEnd(6)} ${String(text).replace(/\s*\n\s*/g, ' | ')}`;
    console.log(`[chatbot] ${line}`);
    try {
      if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > LOG_MAX) fs.renameSync(LOG_FILE, LOG_FILE + '.1');
      fs.appendFileSync(LOG_FILE, line + '\n');
    } catch (err) {
      console.error('[chatbot] could not write log:', err.message);
    }
  }

  /**
   * A grey progress line in game chat, to everyone or only the asker
   * depending on the chat-log setting. `markup` lines are trusted plugin
   * text with chat tags; everything else is sanitized.
   */
  stage(name, text, markup = false) {
    const mode = this.config['chat-log'] ?? 'everyone';
    if (mode === 'off') return;
    const botName = sanitize(this.config['bot-name'] || 'AI');
    const body = markup ? text : sanitize(String(text).slice(0, 180));
    const t = this.current.getStore()?.ticket;
    const msg = `<size="${this.config['thinking-size'] ?? 11}"><color="999"><b>[${botName}]${t ? `[#${t}]` : ''}</> ${body}</></>`;
    if (mode === 'asker') this.whisper(name, msg);
    else this.broadcast(msg);
  }

  broadcast(msg) {
    this.omegga.writeln(`br.Chat.Broadcast ${msg}`);
  }

  whisper(name, msg) {
    this.omegga.writeln(`br.Chat.Whisper "${name}" ${msg}`);
  }

  canBuild(name) {
    if (this.config['anyone-can-build'] ?? true) return true;
    const player = this.omegga.getPlayer(name);
    if (!player) return false;
    return player.isHost() || (this.config['builders'] ?? []).some(p => p.id === player.id);
  }

  async command(name, text) {
    const botName = sanitize(this.config['bot-name'] || 'AI');
    if (!text) {
      this.whisper(name, 'Usage: !ai your message   (!ai reset stops everything and clears my memory)');
      return;
    }
    if (/^reset$/i.test(text)) return this.resetAll(name);
    const cooldown = (this.config['cooldown-seconds'] ?? 5) * 1000;
    const wait = (this.lastUse.get(name) ?? 0) + cooldown - Date.now();
    if (wait > 0) {
      this.whisper(name, `Slow down, try again in ${Math.ceil(wait / 1000)}s.`);
      return;
    }
    const job = await this.startJob(name, 'ai', text);
    if (!job) return;
    this.current.enterWith(job);
    this.lastUse.set(name, Date.now());
    const started = Date.now();
    const secs = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
    this.log('ask', `${name}: ${text}`);
    this.stage(name, `${loading()} ${name}'s request...`);

    const message = { role: 'user', content: `[${name}] ${text}${await this.nearbyBuilds(name)}` };
    let reply;
    const done = [];
    let empties = 0, nudged = false, fixes = 0;
    try {
      const past = this.history.flat();
      const messages = [...past, message];
      for (let round = 0; ; round++) {
        if (job.cancelled) throw Object.assign(new Error('stopped'), { stopped: true });
        const response = await this.callModel(name, SYSTEM, TOOLS, messages, round ? 'working' : 'thinking');
        if (job.cancelled) throw Object.assign(new Error('stopped'), { stopped: true }); // !ai reset while it thought
        const u = response.usage ?? {};
        this.log('model', `round ${round + 1} for ${name} at ${secs()}: stop=${response.stop_reason}, tokens in=${u.input_tokens ?? '?'} out=${u.output_tokens ?? '?'}, blocks [${response.content.map(b => b.type).join(', ')}]`);
        if (response.stop_reason === 'refusal') {
          reply = "Sorry, I can't help with that one.";
          break;
        }
        const uses = response.content.filter(b => b.type === 'tool_use');
        if (response.stop_reason !== 'tool_use' || !uses.length || round >= MAX_TOOL_ROUNDS) {
          reply = response.content
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join(' ')
            .trim();
          // FCC models sometimes degenerate into mixed-script word salad
          if (reply && isGibberish(reply)) {
            this.log('retry', `gibberish answer for ${name} dropped: ${reply.slice(0, 80)}`);
            reply = '';
          }
          // "Rebuilding it now" with no tool call: make it actually call the tool
          if (reply && !nudged && round < MAX_TOOL_ROUNDS && PROMISE.test(reply) && !done.some(r => /^Built /.test(String(r)))) {
            nudged = true;
            this.log('retry', `promise without a build for ${name}, nudging`);
            messages.push({ role: 'assistant', content: reply });
            messages.push({ role: 'user', content: 'You said you would build it but called no tool, so nothing was built. Call the build tool now with the full corrected build.' });
            continue;
          }
          // Some FCC models now and then answer with only a thinking block;
          // asking again usually gets a real answer.
          if (!reply && !done.length && empties < 2) {
            empties++;
            this.log('retry', `empty answer for ${name}, asking again (${empties}/2)`);
            this.stage(name, `got an empty answer, asking again (${empties}/2)...`);
            continue;
          }
          break;
        }
        // Thinking blocks from FCC carry no signature, so only text and
        // tool calls go back into the conversation.
        messages.push({
          role: 'assistant',
          content: response.content.filter(b => b.type === 'text' || b.type === 'tool_use'),
        });
        // While review rounds are left, this round's builds are drafts: rendered
        // and shown back to the model instead of placed (newer drafts replace older)
        job.reviews ??= 0;
        const building = uses.some(u => u.name === 'build');
        job.drafting = building && job.reviews < (this.config['review-rounds'] ?? 2);
        if (job.drafting) job.reviews++;
        if (building) job.pending = []; // this round's build replaces the earlier draft (placed or drafted again)
        const results = await this.runTools(uses, async use => {
          let result, image;
          try {
            this.log('tool', `${use.name} for ${name}: ${JSON.stringify(use.input ?? {})}`);
            result = await this.runTool(name, use.name, use.input ?? {});
            if (result?.image) ({ text: result, image } = result);
            else done.push(result);
            if ((use.name === 'build' && !image) || use.name === 'build_image' || use.name === 'gridhouse') job.built++;
            if (use.name === 'undo_build' && job.built) job.built--;
            this.log('tool', `${use.name} ok: ${result}`);
            this.stage(name, image ? `draft ${job.reviews} rendered at ${secs()}, reviewing it...` : String(result).split('\n')[0]);
          } catch (err) {
            result = `Error: ${err.message ?? err}`;
            this.log('tool', `${use.name} failed: ${err.message ?? err}`);
            this.stage(name, `<color="f88">${use.name} failed: ${sanitize(String(err.message ?? err).slice(0, 150))}</> (letting the AI fix it)`, true);
          }
          const content = image ? [{ type: 'text', text: result }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } }] : result;
          return { type: 'tool_result', tool_use_id: use.id, content };
        });
        messages.push({ role: 'user', content: results });
        if (results.some(r => Array.isArray(r.content))) {
          continue;
        }
        // Asking the model to describe a build that worked costs another
        // 30s+ round trip, so reply straight away unless a tool failed and
        // it needs a chance to fix it.
        // ...but let it go on when the build came back with warnings (it is
        // told to fix those), or after an undo nobody asked for (it is fixing
        // a build and has to build the new one), or after visiting a page (it still has to read it and answer or build)
        const browsed = uses.some(u => u.name === 'visit_site');
        const warned = fixes < 2 && results.some(r => /WARNING/.test(r.content));
        const undoOnly = uses.every(u => u.name === 'undo_build') && !REMOVE.test(text);
        if (browsed) {
          continue;
        }
        if (warned || undoOnly) {
          fixes++;
          if (undoOnly) messages[messages.length - 1].content.push({ type: 'text', text: 'Removed. Now call build with the corrected version.' });
          continue;
        }
        if (!results.some(r => String(r.content).startsWith('Error:'))) {
          const said = response.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
          const built = uses.filter(u => u.name === 'build').map(u => u.input?.name).filter(Boolean);
          reply = said || (built.length ? `Done! Built: ${built.join(', ')}.` : results.map(r => r.content).join(' '));
          break;
        }
      }
      // a draft the model stopped reviewing (it answered instead of calling build) is placed as it is
      job.drafting = false;
      for (const draft of job.pending ?? []) {
        try {
          const r = await this.build(name, { ...draft, final: true });
          done.push(r);
          job.built++;
          this.log('tool', `placed the last draft for ${name}: ${String(r).split('\n')[0]}`);
        } catch (err) {
          reply = `${reply || ''} (Could not place it: ${err.message ?? err})`;
        }
      }
      job.pending = [];
      reply = stripSpeaker(reply || '') || (done.length ? 'Done.' : '...');
      this.remember([...messages.slice(past.length), { role: 'assistant', content: reply }]);
    } catch (err) {
      if (err.stopped) { this.endJob(job); this.log('reset', `${name}: request stopped after ${secs()}`); return; }
      job.failed = true;
      this.endJob(job);
      this.whisper(name, `<color="f55">${this.describe(err)}</>`);
      this.log('error', `${name} after ${secs()}: ${this.describe(err)} (${err.message ?? err})`);
      if ((this.config['chat-log'] ?? 'everyone') === 'everyone') this.stage(name, `<color="f88">failed after ${secs()}</>`, true);
      return;
    }
    this.endJob(job);

    this.log('reply', `${name} after ${secs()}: ${reply}`);
    const lines = toChatLines(reply).slice(0, this.config['max-lines'] ?? 4);
    lines.forEach((line, i) =>
      this.broadcast(`${i === 0 ? `<b><color="8cf">[${botName}][#${job.ticket}]</></>: ` : ''}${sanitize(line)}`)
    );
    if (done.length) this.stage(name, `done in ${secs()}`);
  }

  /** One model call, with a "still thinking... Ns" heartbeat in chat while it runs. */
  async callModel(name, system, tools, messages, doing) {
    // Big models behind FCC can take a minute or more
    const waitStart = Date.now();
    const ticker = setInterval(
      () => this.stage(name, `still ${loading().toLowerCase()}... ${Math.round((Date.now() - waitStart) / 1000)}s`),
      (this.config['progress-seconds'] ?? 15) * 1000
    );
    try {
      const models = [this.config.model || 'claude-opus-5', ...MODEL_FALLBACKS];
      let response;
      for (const model of models) {
        if ((this.modelDown.get(model) ?? 0) > Date.now() && model !== models[models.length - 1]) continue;
        try {
          const lastModel = model === models[models.length - 1];
          response = await this.client.messages.create({ model, max_tokens: 8000, system, tools, messages }, { maxRetries: lastModel ? 1 : 0 });
          break;
        } catch (err) {
          // out of quota or overloaded: skip that slot for a while and try the next one
          const busy = err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && err.status >= 500);
          if (!busy || model === models[models.length - 1]) throw err;
          const daily = /per day/i.test(err.message);
          this.modelDown.set(model, Date.now() + (daily ? 60 : 2) * 60_000);
          this.log('model', `${model} ${err.status}${daily ? ' (daily quota)' : ''}, trying the next model`);
        }
      }
      // The FCC provider now and then degenerates into a run of "!!!!...";
      // drop that so it is never shown and counts as an empty answer, which
      // the callers already retry. Empty text blocks would also be rejected
      // if they went back into the conversation.
      const junk = /!{8,}/g;
      response.content = (response.content ?? [])
        .map(b =>
          b.type === 'text' ? { ...b, text: b.text.replace(junk, '').trim() }
          : b.type === 'thinking' && b.thinking ? { ...b, thinking: b.thinking.replace(junk, '').trim() }
          : b
        )
        .filter(b => b.type !== 'text' || b.text);
      this.showThinking(name, response);
      return response;
    } finally {
      clearInterval(ticker);
    }
  }

  /**
   * The model's thinking blocks, logged in full and posted as dim chat lines
   * (to everyone, only the asker, or nobody, per show-thinking), cut to
   * thinking-lines lines so long reasoning doesn't flood chat.
   */
  showThinking(name, response) {
    const thought = (response.content ?? [])
      .filter(b => b.type === 'thinking' && b.thinking)
      .map(b => b.thinking)
      .join(' ')
      .trim();
    if (!thought) return;
    this.log('think', `${name}: ${thought}`);
    const mode = this.config['show-thinking'] ?? 'everyone';
    if (mode === 'off') return;
    const max = Math.max(1, this.config['thinking-lines'] ?? 3);
    const lines = toChatLines(thought);
    const shown = lines.slice(0, max);
    if (lines.length > max) shown[max - 1] = shown[max - 1].slice(0, LINE - 4) + ' ...';
    const botName = sanitize(this.config['bot-name'] || 'AI');
    shown.forEach((line, i) => {
      const msg = `<size="${this.config['thinking-size'] ?? 11}"><color="777">${i === 0 ? `<b>[${botName}]${this.current.getStore()?.ticket ? `[#${this.current.getStore().ticket}]` : ''} thinking:</> ` : ''}${sanitize(line)}</></>`;
      if (mode === 'asker') this.whisper(name, msg);
      else this.broadcast(msg);
    });
  }

  async runTool(name, tool, input) {
    if (tool === 'build') return this.build(name, input);
    if (tool === 'undo_build') return this.undo(name, input.which);
    if (tool === 'build_image') return this.buildImage(name, input);
    if (tool === 'visit_site') return this.visitSite(input.url);
    if (tool === 'gridhouse') return this.gridHouse(name, input);
    if (tool === 'list_players') return this.listPlayers(name);
    if (tool === 'list_builds') return this.listBuilds(name);
    if (tool === 'say') {
      const botName = sanitize(this.config['bot-name'] || 'AI');
      toChatLines(stripSpeaker(String(input.message ?? ''))).slice(0, 2).forEach((line, i) =>
        this.broadcast(`${i === 0 ? `<b><color="8cf">[${botName}][#${this.current.getStore()?.ticket ?? '?'}]</></>: ` : ''}${sanitize(line)}`)
      );
      return 'Said it.';
    }
    throw new Error(`unknown tool ${tool}`);
  }

  /** Online player by exact name, else the only one whose name contains the query. */
  findPlayer(query) {
    const q = String(query ?? '').toLowerCase().trim();
    const players = this.omegga.getPlayers();
    const exact = players.find(p => p.name.toLowerCase() === q);
    const partial = players.filter(p => p.name.toLowerCase().includes(q));
    const hit = exact ?? (partial.length === 1 ? partial[0] : null);
    return hit ? this.omegga.getPlayer(hit.name) : null;
  }

  async listPlayers(name) {
    const players = this.omegga.getPlayers();
    if (!players.length) return 'Nobody is online.';
    const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
    const where = await Promise.all(
      players.map(p => within(Promise.resolve(this.omegga.getPlayer(p.name)?.getPosition()).catch(() => null), 3000))
    );
    const me = where[players.findIndex(p => p.name === name)];
    return players
      .map((p, i) => {
        const pos = where[i];
        if (!pos) return `${p.name}: not spawned`;
        if (!me) return `${p.name}: spawned`;
        const dx = Math.round((pos[0] - me[0]) / STUD), dy = Math.round((pos[1] - me[1]) / STUD);
        const dz = Math.round((pos[2] - me[2]) / PLATE);
        return `${p.name}${p.name === name ? ' (task giver)' : ''}: x ${dx}, y ${dy} studs, z ${dz} plates, ${Math.round(Math.hypot(dx, dy))} studs away`;
      })
      .join('\n');
  }

  async listBuilds(name) {
    const builds = (await this.store.get('builds')) ?? [];
    if (!builds.length) return 'You have no builds standing.';
    const origin = await this.origin(name);
    return builds
      .map(b => `${b.name.replace(/^AI build: /, '')} (asked by ${b.by}, ${Math.round((Date.now() - b.at) / 60000)} min ago${b.box && origin ? `, at ${this.where(b.box, origin)}` : ''})`)
      .join('\n');
  }

  /** A player's build origin (snapped feet position, units), or null if unknown within 2s. */
  async origin(name) {
    const pos = await Promise.race([
      Promise.resolve(this.omegga.getPlayer(name)?.getPosition()).catch(() => null),
      sleep(2000).then(() => null),
    ]);
    if (!pos) return null;
    return [Math.round(pos[0] / STUD) * STUD, Math.round(pos[1] / STUD) * STUD, Math.max(0, Math.round((pos[2] - FEET) / PLATE) * PLATE)];
  }

  /** A world box in build coordinates relative to an origin: studs for x/y, plates for z. */
  where(box, [ox, oy, oz]) {
    const r = (v, o, u) => Math.round((v - o) / u);
    return `x ${r(box.min[0], ox, STUD)}..${r(box.max[0], ox, STUD)}, y ${r(box.min[1], oy, STUD)}..${r(box.max[1], oy, STUD)} studs, z ${r(box.min[2], oz, PLATE)}..${r(box.max[2], oz, PLATE)} plates`;
  }

  /** Text for a prompt: AI builds within 150 studs of the player, nearest first, in their coordinates. */
  async nearbyBuilds(name) {
    if (!this.boxes.size) return '';
    const origin = await this.origin(name);
    if (!origin) return '';
    const near = [...this.boxes.values()]
      .map(b => {
        const cx = (b.box.min[0] + b.box.max[0]) / 2 - origin[0], cy = (b.box.min[1] + b.box.max[1]) / 2 - origin[1];
        return { b, d: Math.hypot(cx, cy) / STUD };
      })
      .filter(n => n.d <= 150)
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
    if (!near.length) return '';
    return `\n(Builds near ${name}, in ${name}'s coordinates: ${near.map(({ b }) => `"${b.name.replace(/^AI build: /, '')}" ${this.where(b.box, origin)}`).join('; ')})`;
  }

  async agentCommand(name, text) {
    const botName = sanitize(this.config['bot-name'] || 'AI');
    if (!text) {
      this.whisper(name, 'Usage: !agent your task   (!agent stop cancels all of yours; the host can !agent stop all or !agent stop <player>)');
      return;
    }
    const stop = /^stop(?:\s+(.+))?$/i.exec(text);
    if (stop) {
      const agents = [...this.jobs.values()].filter(j => j.kind === 'agent');
      const who = stop[1]?.trim().toLowerCase();
      const targets = !who ? agents.filter(j => j.by === name)
        : who === 'all' ? agents
        : agents.filter(j => j.by.toLowerCase().includes(who));
      if (!targets.length) return this.whisper(name, who ? 'No matching agent task is running.' : 'You have no agent task running.');
      const isHost = this.omegga.getPlayer(name)?.isHost();
      if (targets.some(j => j.by !== name) && !isHost) return this.whisper(name, 'Only the host can stop other players\' agent tasks.');
      for (const j of targets) {
        j.cancelled = true;
        this.log('agent', `${name} stopped ${j.by}'s task`);
      }
      this.stage(name, `${targets.length === 1 ? `${targets[0].by}'s agent` : `${targets.length} agents`} will stop after the current step...`);
      return;
    }
    if (!this.canBuild(name)) return this.whisper(name, 'You are not allowed to use !agent.');

    const job = await this.startJob(name, 'agent', text);
    if (!job) return;
    this.current.enterWith(job);
    const started = Date.now();
    const secs = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;
    const maxSteps = this.config['agent-max-steps'] ?? 12;
    const deadline = started + (this.config['agent-max-minutes'] ?? 10) * 60_000;
    this.log('agent', `${name}: ${text}`);
    this.stage(name, `agent started for ${name}: ${text}`);

    const messages = [{ role: 'user', content: `[${name}] Task: ${text}${await this.nearbyBuilds(name)}` }];
    let summary = null;
    let steps = 0, empties = 0;
    try {
      for (;;) {
        if (job.cancelled) { summary = 'Task stopped.'; break; }
        if (steps >= maxSteps) { summary = `Stopped after ${maxSteps} steps without finishing.`; break; }
        if (Date.now() > deadline) { summary = 'Ran out of time before finishing.'; break; }
        steps++;
        this.stage(name, `step ${steps}/${maxSteps}: ${loading().toLowerCase()}...`);
        const response = await this.callModel(name, agentSystem(maxSteps), AGENT_TOOLS, messages, `on step ${steps}`);
        const u = response.usage ?? {};
        this.log('model', `agent step ${steps} for ${name} at ${secs()}: stop=${response.stop_reason}, tokens in=${u.input_tokens ?? '?'} out=${u.output_tokens ?? '?'}, blocks [${response.content.map(b => b.type).join(', ')}]`);
        if (response.stop_reason === 'refusal') { summary = "Sorry, I can't do that task."; break; }
        const said = response.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
        const uses = response.content.filter(b => b.type === 'tool_use');
        if (!uses.length) {
          // Some FCC models now and then answer with only a thinking block
          if (!said && empties < 2) {
            empties++;
            steps--;
            this.log('retry', `agent empty answer for ${name}, asking again (${empties}/2)`);
            this.stage(name, `got an empty answer, asking again (${empties}/2)...`);
            continue;
          }
          summary = said || 'Done.';
          break;
        }
        if (job.cancelled) { summary = 'Task stopped.'; break; }
        messages.push({ role: 'assistant', content: response.content.filter(b => b.type === 'text' || b.type === 'tool_use') });
        let finished = null;
        const results = await this.runTools(uses, async use => {
          const input = use.input ?? {};
          if (use.name === 'finish') {
            finished = String(input.summary || said || 'Done.');
            return { type: 'tool_result', tool_use_id: use.id, content: 'Finished.' };
          }
          let result;
          try {
            this.log('tool', `agent ${use.name} for ${name}: ${JSON.stringify(input)}`);
            if (use.name !== 'say') this.stage(name, `step ${steps}: ${describeTool(use.name, input)}`);
            result = await this.runTool(name, use.name, input);
            if (use.name === 'build' || use.name === 'build_image') job.built++;
            this.log('tool', `agent ${use.name} ok: ${result}`);
            if (use.name === 'build' || use.name === 'undo_build') this.stage(name, String(result).split('\n')[0]);
          } catch (err) {
            result = `Error: ${err.message ?? err}`;
            this.log('tool', `agent ${use.name} failed: ${err.message ?? err}`);
            this.stage(name, `<color="f88">${use.name} failed: ${sanitize(String(err.message ?? err).slice(0, 150))}</>`, true);
          }
          return { type: 'tool_result', tool_use_id: use.id, content: result };
        });
        messages.push({ role: 'user', content: results });
        if (finished !== null) { summary = finished; break; }
      }
    } catch (err) {
      job.failed = true;
      this.whisper(name, `<color="f55">${this.describe(err)}</>`);
      this.log('error', `agent for ${name} after ${secs()}: ${this.describe(err)} (${err.message ?? err})`);
      this.stage(name, `<color="f88">agent failed after ${secs()}</>`, true);
    } finally {
      this.endJob(job);
    }
    if (summary === null) return;
    summary = stripSpeaker(summary);
    this.log('agent', `${name}'s task done after ${steps} steps, ${secs()}: ${summary}`);
    toChatLines(summary).slice(0, this.config['max-lines'] ?? 4).forEach((line, i) =>
      this.broadcast(`${i === 0 ? `<b><color="8cf">[${botName}][#${job.ticket}]</></>: ` : ''}${sanitize(line)}`)
    );
    this.stage(name, `agent done: ${steps} step${steps === 1 ? '' : 's'} in ${secs()}`);
  }

  async build(name, input) {
    let { name: what, parts, bricks: legacy, near, allow_overlap, final } = input;
    if (!this.canBuild(name)) throw new Error(`${name} is not allowed to make me build`);
    // Weak models sometimes still send the old brick list
    if (!Array.isArray(parts)) parts = Array.isArray(legacy) ? legacy.map(b => ({ type: 'box', ...b })) : [];
    if (!parts.length) throw new Error('no parts given');
    const bricks = shapes.expand(parts);
    // Never build on top of the player: if anything low enough to trap them
    // covers the spot they stand on, slide the whole build along +x.
    const traps = b => b.x < 2 && b.x + b.w > -2 && b.y < 2 && b.y + b.l > -2 && b.z < 18;
    if (bricks.some(traps)) {
      const dx = 3 - Math.min(...bricks.map(b => b.x));
      for (const b of bricks) b.x += dx;
    }
    const max = this.config['max-bricks'] ?? 2000;
    if (bricks.length > max) throw new Error(`that is ${bricks.length} bricks, max ${max}; make it smaller`);

    // While review rounds are left (command() sets drafting), render it for the model instead of placing it
    const job = this.current.getStore();
    // "final" means "the draft I just saw is excellent": a changed part list is a new draft that needs a look
    if (job?.drafting && final && JSON.stringify(parts) !== JSON.stringify(job.lastDraft)) final = false;
    if (job?.drafting && !final) {
      job.lastDraft = parts;
      job.pending.push(input);
      const last = job.reviews >= (this.config['review-rounds'] ?? 2);
      const warn = (bricks.warnings ?? []).map(w => `\nWARNING: ${w}`).join('');
      const thing = String(what || job.text || 'the build');
      return {
        text: `DRAFT ${job.reviews} of "${thing}" (${bricks.length} bricks): NOT placed yet.${warn}\n` +
          `The picture: LEFT = seen from in front and a bit to the left (the player's side, low x), RIGHT = from behind (high x). The blue figure is a player for scale (2 studs wide, 15 plates tall), ground squares are 1 stud.\n` +
          `Review it like a harsh art director comparing it with a real ${thing}: silhouette and proportions, missing signature features, big flat blocky areas that need shape or detail, colors and shading, parts floating or not touching, anything facing the wrong way, size next to the player.\n` +
          `Then call build again with the COMPLETE improved part list (every part, not only the changes)${last ? '; that build is placed for real' : '; it comes back as another draft'}. Never undo_build to fix a draft: drafts are not in the world. Only if it is truly excellent already, call build with the same parts and final true.\n` +
          shapes.preview(bricks),
        image: render(bricks).toString('base64'),
      };
    }

    const target = near ? this.findPlayer(near) : this.omegga.getPlayer(name);
    if (near && !target) throw new Error(`no online player matches "${near}" (use list_players)`);
    const pos = target && (await target.getPosition());
    if (!pos) throw new Error(`${target?.name ?? name} has not spawned, so there is nowhere to build`);

    const limit = this.config['max-distance'] ?? 200;
    const save = bricks.map(b => toSaveBrick(b, limit));
    const note = await this.spawn(name, target, pos, what, save, `${parts.length} parts [${parts.map(p => p.type ?? 'box').join(', ')}]`, !!allow_overlap);
    const warn = (bricks.warnings ?? []).map(w => `\nWARNING: ${w}`).join('');
    return `Built ${save.length} bricks next to ${target.name}.${note}${warn}${warn ? '\nFix the warnings: call undo_build with "last", then build again corrected.' : ''}\n${shapes.preview(bricks)}`;
  }

  /** Load save bricks (units, relative to the player) under a new owner, and remember the build for undo. */
  async spawn(name, target, pos, what, save, detail, allowOverlap = false) {
    const owner = { id: crypto.randomUUID(), name: `AI build: ${String(what || 'build').slice(0, 40)}` };

    // Snap the origin to the stud and plate grids so builds line up with
    // normal building.
    let offX = Math.round(pos[0] / STUD) * STUD;
    let offY = Math.round(pos[1] / STUD) * STUD;
    const offZ = Math.max(0, Math.round((pos[2] - FEET) / PLATE) * PLATE);

    let moved = null;
    if (!allowOverlap && (this.config['avoid-overlap'] ?? true)) {
      const spot = await this.findSpot(save, [offX, offY, offZ], what);
      offX += spot.dx;
      offY += spot.dy;
      if (spot.dx || spot.dy) moved = spot;
    }
    const box = unionBox(save.map(b => brickBox(b, [offX, offY, offZ])));
    // Claim the space right away so parallel builds can't pick it too.
    this.boxes.set(owner.id, { name: owner.name, by: name, box });

    const ref = `omegga_ai_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const file = path.join(this.prefabDir, ref + '.brz');
    fs.writeFileSync(file, this.brs.writeBrzLegacy(toLegacySave(save, owner)));
    // atOriginalPosition=0, orientation=16 (Z_Positive_0, upright)
    this.omegga.writeln(`br.Prefab.Load "${ref}" ${offX} ${offY} ${offZ} 0 16`);
    setTimeout(() => fs.rmSync(file, { force: true }), 10000);
    this.log('build', `"${owner.name}" owner ${owner.id}: ${detail}, ${save.length} bricks at ${offX} ${offY} ${offZ} near ${target.name} for ${name}${moved ? `, moved ${moved.dx / STUD} ${moved.dy / STUD} studs off ${moved.hit}` : ''}${allowOverlap ? ', overlap allowed' : ''}`);

    await this.updateBuilds(builds => {
      builds.push({ id: owner.id, name: owner.name, by: name, at: Date.now(), box });
    });
    // Tell the model where it really went, in the asker's frame.
    if (!moved) return '';
    return ` It overlapped ${moved.hit}, so it was moved ${moved.dx / STUD} studs along x and ${moved.dy / STUD} along y (to x ${Math.round((box.min[0] - Math.round(pos[0] / STUD) * STUD) / STUD)}..${Math.round((box.max[0] - Math.round(pos[0] / STUD) * STUD) / STUD)}, y ${Math.round((box.min[1] - Math.round(pos[1] / STUD) * STUD) / STUD)}..${Math.round((box.max[1] - Math.round(pos[1] / STUD) * STUD) / STUD)}).`;
  }

  /**
   * Where a build can go without overlapping bricks that are already there:
   * other AI builds (their stored boxes) and, when the world scan works,
   * any bricks in the area. Tries the requested spot first, then the
   * nearest free offsets on a 2-stud grid out to search-radius studs.
   */
  async findSpot(save, origin, what) {
    const own = save.map(b => brickBox(b, origin));
    const whole = unionBox(own);
    const radius = (this.config['search-radius'] ?? 60) * STUD;
    const area = { min: [whole.min[0] - radius, whole.min[1] - radius, whole.min[2]], max: [whole.max[0] + radius, whole.max[1] + radius, whole.max[2]] };

    const world = (this.config['scan-world'] ?? true) ? await this.scanRegion(area, origin[2]) : null;
    // Everything below is synchronous, so parallel builds see each other's claims.
    const obstacles = [];
    for (const [, b] of this.boxes) if (overlaps(b.box, area, 0)) obstacles.push({ box: b.box, label: `"${b.name.replace(/^AI build: /, '')}"` });
    for (const box of world ?? []) obstacles.push({ box, label: 'existing bricks' });
    // The player who is building stands at the origin.
    const player = { min: [origin[0] - 2 * STUD, origin[1] - 2 * STUD, origin[2]], max: [origin[0] + 2 * STUD, origin[1] + 2 * STUD, origin[2] + 18 * PLATE] };

    const hitAt = (dx, dy) => {
      const moved = moveBox(whole, dx, dy);
      if ((dx || dy) && overlaps(moved, player, 0)) return 'the player';
      const near = obstacles.filter(o => overlaps(moved, o.box));
      if (!near.length) return null;
      // The bounding boxes touch; check brick by brick.
      for (const o of near) if (own.some(b => overlaps(moveBox(b, dx, dy), o.box))) return o.label;
      return null;
    };

    const first = hitAt(0, 0);
    if (!first) return { dx: 0, dy: 0 };
    const steps = [];
    for (let x = -radius; x <= radius; x += 2 * STUD)
      for (let y = -radius; y <= radius; y += 2 * STUD) if (x || y) steps.push([x, y]);
    steps.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
    for (const [dx, dy] of steps) if (!hitAt(dx, dy)) return { dx, dy, hit: first };
    throw new Error(
      `"${what || 'that'}" would overlap ${first} and there is no free spot within ${radius / STUD} studs. ` +
      'Build it smaller or somewhere else, or set allow_overlap true if it is meant to join onto them.'
    );
  }

  /**
   * Boxes (world units) of the bricks already in a region, from a
   * br.Prefab.SaveRegion dump, leaving out the ground the build stands on.
   * Returns null when the scan doesn't work, so building still goes ahead.
   */
  async scanRegion(area, floorZ) {
    const center = [0, 1, 2].map(i => Math.round((area.min[i] + area.max[i]) / 2));
    const extent = [0, 1, 2].map(i => Math.ceil((area.max[i] - area.min[i]) / 2) + 1);
    const ref = `omegga_ai_scan_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const started = Date.now();
    // Watch the game log: once the command has run, a missing file means the
    // area was empty, so there is no need to wait the full timeout. The
    // game's reply lines are logged to show what it said.
    let echoed = 0;
    const said = [];
    const onLine = line => {
      if (line.includes(ref)) echoed ||= Date.now();
      else if (echoed && said.length < 3 && !line.includes("LogConsoleCmd") && /prefab|save|brick|region|error|warn/i.test(line))
        said.push(String(line).replace(/^\[[^\]]*\]\[[^\]]*\]/, '').trim().slice(0, 160));
    };
    this.omegga.on('line', onLine);
    this.omegga.writeln(`br.Prefab.SaveRegion "${ref}" ${center.join(' ')} ${extent.join(' ')} 0`);
    let file = null, size = -1;
    try {
      // Wait for the file to show up and stop growing.
      while (Date.now() - started < 5000 && !(echoed && !file && Date.now() - echoed > 1500)) {
        await sleep(100);
        file ??= findFile(this.prefabDir, ref) ?? findFile(path.dirname(this.prefabDir), ref);
        if (!file) continue;
        const now = fs.statSync(file).size;
        if (now > 0 && now === size) break;
        size = now;
      }
    } finally {
      this.omegga.off('line', onLine);
    }
    if (!file) {
      // An empty region writes nothing, so a miss is normal; only log it.
      this.log('scan', `no save from SaveRegion after ${Date.now() - started}ms (${echoed ? 'command ran' : 'no echo seen'}; empty area, or the scan doesn't work) at ${center} ext ${extent}; game said: ${said.join(' | ') || 'nothing'}`);
      return [];
    }
    try {
      const reader = this.brs.WorldReader.from(fs.readFileSync(file));
      const raw = [...reader.bricks()];
      // Positions may be saved relative to the region center or absolute;
      // use whichever puts more bricks inside the region.
      const inside = off => raw.filter(b => [0, 1, 2].every(i => Math.abs(b.position[i] + off[i] - center[i]) <= extent[i] + 10)).length;
      const absolute = inside([0, 0, 0]), relative = inside(center);
      const off = relative > absolute ? center : [0, 0, 0];
      const boxes = raw
        .map(b => brickBox({ ...b, size: b.size?.some(v => v > 0) ? b.size : [5, 5, 6], rotation: b.rotation ?? 0 }, off))
        .filter(b => b.max[2] > floorZ + PLATE);
      this.log('scan', `${raw.length} bricks (${boxes.length} above the floor) in ${Date.now() - started}ms${said.length ? ` (game said: ${said.join(" | ")})` : ""}, frame ${off === center ? 'relative' : 'absolute'} (${absolute} vs ${relative} inside), region ${center} ext ${extent}, sample ${JSON.stringify(raw[0]?.position)}`);
      return boxes;
    } catch (err) {
      this.log('scan', `could not read region save: ${err.message}`);
      return null;
    } finally {
      fs.rmSync(file, { force: true });
    }
  }

  /** fetch() a public http(s) link, following redirects by hand so every hop is checked against private addresses. */
  async safeFetch(link, accept) {
    let url;
    try {
      url = new URL(String(link ?? '').trim().replace(/^<|>$/g, ''));
    } catch {
      throw new Error('that is not a valid link');
    }
    for (let hops = 0; ; hops++) {
      if (!/^https?:$/.test(url.protocol)) throw new Error('only http and https links work');
      const host = url.hostname.replace(/^\[|\]$/g, '');
      const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
      if (!addrs.length) throw new Error(`can't find the site ${host}`);
      if (addrs.some(a => isPrivateAddress(a.address))) throw new Error('that link points at a private network address');
      const res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
        headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) omegga-chatbot', accept },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        if (hops >= 5) throw new Error('that link redirects too many times');
        url = new URL(res.headers.get('location'), url);
        continue;
      }
      if (!res.ok) throw new Error(`the link answered HTTP ${res.status}`);
      return { res, url };
    }
  }

  /** Read a capped body; throws past max bytes. */
  async readBody(res, max, tooBig) {
    if (Number(res.headers.get('content-length')) > max) throw new Error(tooBig);
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > max) throw new Error(tooBig);
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /** Download an image link to a file, refusing private addresses, web pages and huge files. */
  async fetchImage(link, file) {
    const { res, url } = await this.safeFetch(link, 'image/*,*/*;q=0.5');
    const type = res.headers.get('content-type') ?? '';
    if (/^text\/html/i.test(type))
      throw new Error('that link is a web page, not an image; use a direct image link (right-click the image, Copy image address)');
    fs.writeFileSync(file, await this.readBody(res, IMAGE_MAX_BYTES, 'that image is too big (20 MB max)'));
    return url.href;
  }

  /** A web page as plain text plus its links and image links, for the visit_site tool. */
  async visitSite(link) {
    const { res, url } = await this.safeFetch(link, 'text/html,text/plain,application/json;q=0.9,*/*;q=0.1');
    const type = res.headers.get('content-type') ?? '';
    if (/^(image|video|audio)\//i.test(type)) return `${url.href} is a ${type} file, not a page.${/^image/i.test(type) ? ' Pass it to build_image to build it.' : ''}`;
    const body = (await this.readBody(res, PAGE_MAX_BYTES, 'that page is too big (3 MB max)')).toString('utf8');
    if (!/html/i.test(type)) return `${url.href} (${type}):\n${body.slice(0, PAGE_TEXT)}`;
    const abs = href => {
      try {
        const u = new URL(decodeEntities(href), url);
        // Bing result links are redirects (u = "a1" + base64url of the target): hand the model the real target
        const target = (u.hostname.endsWith('bing.com') && u.pathname === '/ck/a' && u.searchParams.get('u')) || '';
        return target.startsWith('a1') ? Buffer.from(target.slice(2), 'base64url').toString() : u.href;
      } catch {
        return null;
      }
    };
    const title = decodeEntities(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
    const main = stripMenus(body.match(/<(main|article)\b[\s\S]*<\/\1>/i)?.[0] ?? body);
    const links = [], images = new Set();
    for (const m of main.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const href = abs(m[1]), text = htmlText(m[2]).slice(0, 80);
      if (href && /^https?:/.test(href) && text && links.length < 40) links.push(`${text} -> ${href}`);
    }
    for (const m of body.matchAll(/<(?:img\b[^>]*?\bsrc|meta\b[^>]*?property\s*=\s*["']og:image["'][^>]*?\bcontent)\s*=\s*["']([^"']+)["']/gi)) {
      const src = abs(m[1]);
      if (src && /^https?:/.test(src) && images.size < 20) images.add(src);
    }
    return [
      `Page ${url.href}${title ? ` "${title}"` : ''}:`,
      htmlText(main).slice(0, PAGE_TEXT),
      links.length ? `Links:\n${links.join('\n')}` : '',
      images.size ? `Image links:\n${[...images].join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
  }

  /** Picture from an image link, converted with heightmap2brz and placed like a build. */
  async buildImage(name, { url, name: what, x, y, z, width, pixel_size, facing, glow, near, allow_overlap }) {
    if (!this.canBuild(name)) throw new Error(`${name} is not allowed to make me build`);
    if (!url) throw new Error('no image link given');
    if (!fs.existsSync(HEIGHTMAP)) throw new Error('heightmap2brz is not installed on the server (bin/heightmap)');
    const target = near ? this.findPlayer(near) : this.omegga.getPlayer(name);
    if (near && !target) throw new Error(`no online player matches "${near}" (use list_players)`);
    const pos = target && (await target.getPosition());
    if (!pos) throw new Error(`${target?.name ?? name} has not spawned, so there is nowhere to build`);

    const maxWidth = this.config['image-max-width'] ?? 128;
    const cols = num(width, 4, maxWidth, Math.min(64, maxWidth));
    const scale = num(pixel_size, 1, 8, 1);
    const side = facing === 'flat' || PICTURE_RIGHT[facing] ? facing : '-x';
    const limit = this.config['max-distance'] ?? 200;

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omegga-ai-img-'));
    try {
      const src = path.join(dir, 'source'), png = path.join(dir, 'image.png'), out = path.join(dir, 'image.brz');
      const from = await this.fetchImage(url, src);
      // First frame only, never upscaled, at most `cols` wide and twice that tall.
      await run('ffmpeg', [
        '-loglevel', 'error', '-y', '-i', src, '-frames:v', '1',
        '-vf', `scale=w='min(${cols},iw)':h='min(${cols * 2},ih)':force_original_aspect_ratio=decrease:flags=area`,
        '-pix_fmt', 'rgba', png,
      ]).catch(() => {
        throw new Error("couldn't read that file as an image (png, jpg, gif and webp work)");
      });
      await run(HEIGHTMAP, [png, '--img', '--greedy', '--cull', '-o', out]);
      const reader = this.brs.WorldReader.from(fs.readFileSync(out));
      const picture = pictureToSave(reader, {
        x: num(x, -limit, limit, 12),
        y: num(y, -limit, limit, 0),
        z: num(z, 0, 1000, 0),
        scale,
        facing: side,
        glow: !!glow,
      });
      const max = this.config['image-max-bricks'] ?? 20000;
      if (picture.save.length > max)
        throw new Error(`that picture is ${picture.save.length} bricks, max ${max}; use a smaller width`);
      const label = what || 'picture';
      const note = await this.spawn(name, target, pos, label, picture.save, `picture ${picture.width}x${picture.height} px, x${scale}, facing ${side}, from ${from}`, !!allow_overlap);
      return `Built a ${picture.width * scale}x${picture.height * scale} stud picture (${picture.save.length} bricks) next to ${target.name}.${note}`;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  /** gridhouse tool: run lib/gridhouse on a text plan, place its bricks like any AI build. */
  async gridHouse(name, { rows, name: what, x, y, roof_color, allow_overlap }) {
    if (!this.canBuild(name)) throw new Error(`${name} is not allowed to make me build`);
    if (!Array.isArray(rows) || !rows.length) throw new Error('no plan rows given');
    rows = rows.map(r => String(r).toUpperCase());
    if (rows.length > 80 || rows.some(r => r.length > 80 || !/^[YRG.]+$/.test(r))) throw new Error('plan rows must be at most 80x80 and use only Y, R, G and .');
    if (!rows.some(r => r.includes('R'))) throw new Error('the plan has no room (R) pixels');
    // models forget the front door: no G between outside and a room -> turn the outer wall pixel nearest the
    // middle of the player-facing (low x) side into one
    const wide = Math.max(...rows.map(r => r.length));
    const g = rows.map(r => [...r.padEnd(wide, '.')]);
    const cell = (i, j) => g[j]?.[i] ?? '.';
    const SIDES4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const entry = (i, j) => SIDES4.some(([dx, dy]) => cell(i + dx, j + dy) === '.' && cell(i - dx, j - dy) === 'R');
    let doorNote = '';
    if (!g.some((r, j) => r.some((c, i) => c === 'G' && entry(i, j)))) {
      const spots = [];
      g.forEach((r, j) => r.forEach((c, i) => { if (c === 'Y' && entry(i, j)) spots.push([i + Math.abs(j - (g.length - 1) / 2) / g.length, i, j]); }));
      spots.sort((a, b) => a[0] - b[0]);
      if (spots[0]) { const [, i, j] = spots[0]; g[j][i] = 'G'; doorNote = ' The plan had no outside door, so one was added on the low-x side.'; }
    }
    rows = g.map(r => r.join(''));
    const target = this.omegga.getPlayer(name);
    const pos = target && (await target.getPosition());
    if (!pos) throw new Error(`${name} has not spawned, so there is nowhere to build`);
    const limit = this.config['max-distance'] ?? 200;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omegga-ai-gh-'));
    try {
      const plan = path.join(dir, 'plan.txt'), out = path.join(dir, 'job.json');
      fs.writeFileSync(plan, rows.join(String.fromCharCode(10)));
      const ox = num(x, -limit, limit, 3) * STUD, oy = num(y, -limit, limit, 0) * STUD;
      await run(process.execPath, [GRIDHOUSE, plan, String(ox), String(oy), '0', out]);
      const save = JSON.parse(fs.readFileSync(out)).ops.find(o => o.op === 'bricks').bricks
        .map(b => ({ material: 'BMC_Plastic', direction: 4, rotation: 0, ...b }));
      // roof on the 104-unit (26-plate) ceiling top, over the plan (roof() adds the eave)
      const width = Math.max(...rows.map(r => r.length));
      save.push(...shapes.expand([{ type: 'roof', style: 'pitched', x: ox / STUD, y: oy / STUD, z: 26, w: width, l: rows.length, color: roof_color || '#8b3a2a' }]).map(b => toSaveBrick(b, limit + 100)));
      const max = this.config['image-max-bricks'] ?? 20000;
      if (save.length > max) throw new Error(`that house is ${save.length} bricks, max ${max}; draw a smaller plan`);
      const note = await this.spawn(name, target, pos, what || 'house', save, `gridhouse ${rows[0].length}x${rows.length} plan`, !!allow_overlap);
      return `Built a ${rows[0].length}x${rows.length} stud house with a roof (${save.length} bricks) next to ${name}.${doorNote}${note}`;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  /** `!img <url> [width] [pixel size] [flat|-x|+x|-y|+y] [glow]`, no AI involved. */
  async imageCommand(name, args) {
    const botName = sanitize(this.config['bot-name'] || 'AI');
    const [url, ...rest] = args.join(' ').trim().split(/\s+/).filter(Boolean);
    if (!url) {
      this.whisper(name, 'Usage: !image image-link [width] [pixel size] [flat] [glow]   ("!ai undo" removes it)');
      return;
    }
    const nums = rest.filter(a => /^\d+$/.test(a)).map(Number);
    const input = {
      url,
      name: 'picture',
      width: nums[0],
      pixel_size: nums[1],
      facing: rest.find(a => a === 'flat' || PICTURE_RIGHT[a]),
      glow: rest.includes('glow'),
    };
    const job = await this.startJob(name, 'img', args.join(' '));
    if (!job) return;
    this.current.enterWith(job);
    const started = Date.now();
    this.log('image', `${name}: ${args.join(' ')}`);
    this.stage(name, `${describeTool('build_image', input)}`);
    try {
      const result = await this.buildImage(name, input);
      job.built++;
      this.log('image', `ok for ${name} in ${((Date.now() - started) / 1000).toFixed(1)}s: ${result}`);
      this.stage(name, String(result).split('\n')[0]);
    } catch (err) {
      job.failed = true;
      this.log('image', `failed for ${name}: ${err.message ?? err}`);
      this.whisper(name, `<color="f55">Picture failed: ${sanitize(String(err.message ?? err).slice(0, 160))}</>`);
    } finally {
      this.endJob(job);
    }
  }

  async undo(name, which) {
    if (!this.canBuild(name)) throw new Error(`${name} is not allowed to undo builds`);
    const gone = await this.updateBuilds(builds => {
      if (which === 'all') return builds.splice(0);
      // With several players building at once, "last" means the asker's own
      // newest build when they have one.
      let i = builds.map(b => b.by).lastIndexOf(name);
      if (i === -1) i = builds.length - 1;
      return i === -1 ? [] : builds.splice(i, 1);
    });
    if (!gone.length) return 'There are no builds to remove.';
    for (const b of gone) {
      this.omegga.writeln(`br.Bricks.Clear ${b.id} 1`);
      this.boxes.delete(b.id);
      this.log('undo', `"${b.name}" owner ${b.id} (built by ${b.by}) removed for ${name}`);
    }
    return `Removed ${gone.length} build${gone.length === 1 ? '' : 's'}.`;
  }

  /**
   * Keep a rolling window of whole exchanges, oldest dropped first. Each
   * exchange keeps its real tool calls and results: summarizing them as
   * text taught the model to write "(Built 45 bricks)" without building.
   */
  remember(turn) {
    // renders are big: remembered turns keep the review text only
    const noImages = c => (Array.isArray(c) ? c.filter(b => b.type !== 'image').map(b => (b.type === 'tool_result' ? { ...b, content: noImages(b.content) } : b)) : c);
    this.history.push(turn.map(m => ({ ...m, content: noImages(m.content) })));
    const max = Math.max(1, Math.floor((this.config['memory-messages'] ?? 20) / 2));
    if (this.history.length > max) this.history = this.history.slice(-max);
  }

  describe(err) {
    if (err instanceof Anthropic.APIConnectionError)
      return `Can't reach the AI proxy at ${this.baseURL}. Is fcc-server running?`;
    // FCC passes provider auth failures through as 401 too
    if (err instanceof Anthropic.AuthenticationError)
      return /upstream provider/i.test(err.message)
        ? "FCC's provider API key is missing or wrong. Set it in the FCC admin page."
        : 'The AI proxy rejected the token (check proxy-token vs ANTHROPIC_AUTH_TOKEN in FCC).';
    if (err instanceof Anthropic.RateLimitError)
      return 'The AI provider is rate limiting us, try again shortly.';
    if (err instanceof Anthropic.APIError)
      return `AI proxy error ${err.status ?? ''}: ${String(err.message).slice(0, 120)}`;
    return `AI request failed: ${String(err.message ?? err).slice(0, 120)}`;
  }

  /** !ai reset (2026-10-13, owner: "its tweaking"): stop every running request, drop
   * the waiting line, free the slots, clear memory and cooldowns. */
  resetAll(name) {
    const botName = sanitize(this.config['bot-name'] || 'AI');
    const running = [...this.jobs], waiting = this.queue.length;
    for (const job of running) { job.cancelled = true; this.jobs.delete(job); }
    for (const { job, resolve } of this.queue) { job.cancelled = true; resolve(null); }
    this.queue = [];
    this.updateTickets(list => { for (const t of list) if (t.status === 'working' || t.status === 'waiting') t.status = 'cancelled'; }).catch(() => {});
    this.history = [];
    this.lastUse.clear();
    this.log('reset', `${name}: ${running.length} running stopped, ${waiting} waiting dropped`);
    this.broadcast(`<b><color="8cf">${botName}</></> reset by ${sanitize(name)}: memory cleared, ${running.length} running and ${waiting} waiting requests stopped.`);
  }

  async stop() {
    this.log('stop', 'plugin unloaded');
    for (const job of this.jobs.values()) job.cancelled = true;
    for (const e of EVENTS) this.omegga.off(e, this.handler);
    for (const e of AGENT_EVENTS) this.omegga.off(e, this.agentHandler);
    for (const e of IMAGE_EVENTS) this.omegga.off(e, this.imageHandler);
    for (const [e, h] of this.extraHandlers ?? []) this.omegga.off(e, h);
    for (const { resolve } of this.queue) resolve(null);
    this.queue = [];
  }
};
