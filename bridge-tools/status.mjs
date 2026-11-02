// Claude status board (2026-11-02, owner in chat: "make a status indicator and output all text here so we know what
// stage you are completing through a text component"): one big TextDisplay brick in front of the Longbrooke slot in
// the fun-area gallery, owned by 'Claude Status' so each update = clear that owner + one bricks op in one job.
//   node bridge-tools/status.mjs "line one" "line two" ...      (sends the job over ssh into the bridge inbox)
import { execFileSync } from 'child_process';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000057a705', name: 'Claude Status', display_name: 'Claude Status' };
const AT = [1000, -16090, 90], SIZE = [220, 6, 90];
const lines = process.argv.slice(2);
if (!lines.length) throw new Error('usage: status.mjs "line" ...');
const stamp = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
const text = ['CLAUDE STATUS  ' + stamp, ...lines].join('\n');
const sign = {
  asset: 'PB_DefaultMicroBrick', color: [24, 28, 40], size: SIZE, position: AT,
  components: [{ type: 'Component_TextDisplay', data: {
    Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 18, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 },
    Offset: { X: 0, Y: 0, Z: 0.2 }, Color: { R: 255, G: 236, B: 160, A: 255 }, MaterialSlider: 10, ShadingWidth: 0,
    OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0, ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45,
    GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true, Typeface: 0, Billboard: 0,
    Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true,
    bOverrideOutlineColor: true, bForeground: false, Text: text } }],
};
const job = { ops: [{ op: 'clear', owner: OWNER.id }, { op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 2000,
  externalAssets: [{ type: 'BrickFontDescriptor', name: 'MonaspaceXenon' }], bricks: [sign] }] };
const id = `${Date.now()}_status.json`, inbox = 'omegga-server/bridge/inbox';
execFileSync('ssh', ['pzedlo.hopto.org', `cat > ${inbox}/${id}.tmp && mv ${inbox}/${id}.tmp ${inbox}/${id}`], { input: JSON.stringify(job) });
console.log('status sent:', lines.join(' | '));
