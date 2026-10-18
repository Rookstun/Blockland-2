// Sky self-test for the temple arrow trap (2026-10-18): a Component_ProjectileSpawner on a plain
// micro brick fires Projectile_Bow_Charged along +x into a zone (Component_Internal_AttachedZone,
// bDetectProjectiles) whose ProjectileZoneEvent_Entered gate logs "trap.test|<weapon>", and the
// spawner's OnFired logs "trap.fired". Also: the zone's bOccupied drives nothing here.
//   node npctalk/traptest.mjs <brs-js 4 dist.mjs> <out.brz> [projectile class type]
import { writeFileSync } from 'node:fs';
const [dist, out, classType = 'BRWeaponProjectile'] = process.argv.slice(2);
const lib = await import(new URL(`file:///${dist.replace(/\\/g, '/')}`).href);
const C = lib.brdb.COMPONENTS;
const w = new lib.World();
const o = w.addOwner({ id: 'ea32a1c0-0000-4b0b-9a11-0000000057a6', name: 'Trap Test', display_name: 'Trap Test' });
const EXT = [{ type: classType, name: 'Projectile_Bow_Charged' }];
const brick = (asset, position, size, components, extra = {}) => w.addBrick({ asset, position, size, color: [200, 80, 60], owner_index: o, components, ...extra });
const spawner = brick('PB_DefaultMicroBrick', [0, 0, 0], [6, 6, 6], [{ type: C.ProjectileSpawner.NAME, data: {
  ProjectileClass: 0, FireSound: null, Direction: 0, SpawnLocation: 0, SpawnMargin: 5, SpawnOffsetBias: 0, bEnabled: true, NumberOfShots: 1, SpreadConeAngle: 0,
  bSpreadBiasedTowardsCenter: false, FireRate: 1, bEnforceFireRate: true, DamageMultiplier: 1, SpeedMultiplier: 1, ScaleMultiplier: 1 } }]);
const zone = brick('PB_DefaultMicroBrick', [200, 0, -40], [20, 40, 2], [{ type: C.AttachedZone.NAME, data: {
  ZoneStartDistance: 0, ZoneEndDistance: 100, bIsBuildingZone: false, bIsLooseZone: false, bIsShareZone: false, bWater: false,
  bDetectPlayers: true, bDetectPlayers1: true, bDetectPlayers2: true, bDetectPlayers3: true, bDetectEntities: false, bDetectProjectiles: true, TagFilter: '', ZoneWindForce: 0 } }]);
let gx = 0;
const gate = (c, data = {}) => ({ h: brick(c.BRICK, [gx += 20, 200, 0], undefined, [{ type: c.NAME, data }]), c });
const wire = (a, ap, b, bp) => w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
const ev = gate(C.ProjectileZoneEvent_Entered);
wire({ h: zone, c: C.AttachedZone }, 'ZoneRef', ev, 'Zone');
const f = gate(C.Expr_String_FormatText, { FormatString: 'trap.test|{A}' }); wire(ev, 'WeaponName', f, 'InputA');
const p = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', p, 'Text'); wire(ev, 'Exec', p, 'Exec');
const f2 = gate(C.Expr_String_FormatText, { FormatString: 'trap.fired' });
const p2 = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f2, 'Output', p2, 'Text'); wire({ h: spawner, c: C.ProjectileSpawner }, 'OnFired', p2, 'Exec');
w.makePrefab({});
writeFileSync(out, w.toBrz({ bundle: { description: 'trap test' }, externalAssets: EXT }));
console.log(out);
