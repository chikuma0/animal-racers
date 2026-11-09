import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { raceFraming, combatFraming, resultsFraming, sceneForPhase, saloonPose } from "./framing";
import { createDuelMatch, neutralInput, stepMatch, FIXED_DT } from "./simulation";

describe("combat camera framing", () => {
  it("separates same-lane finishers during the saloon introduction and meets the real fight opening without a position jump", () => {
    const match = createDuelMatch(["unicorn", "unicorn"]);
    const finishers = [0, 1].map(() => ({ x: 3.8, y: .6, facing: 1 }));
    const unchanged = structuredClone(finishers);
    // The observed old renderer used these overlapping race positions.
    expect(Math.abs(finishers[0].x - finishers[1].x)).toBe(0);
    const staged = finishers.map((p, slot) => saloonPose(p, slot, "transition"));
    expect(staged[1].x - staged[0].x).toBeGreaterThan(2.4);
    expect(staged[0].facing).toBe(1); expect(staged[1].facing).toBe(-1);
    expect(staged.every(p => p.y === 0)).toBe(true);
    expect(finishers).toEqual(unchanged);
    for (let tick = 0; tick < 241 && match.phase === "transition"; tick++) stepMatch(match, [neutralInput(), neutralInput()], FIXED_DT);
    expect(match.phase).toBe("fight");
    expect(staged).toEqual(match.players.map((p, slot) => saloonPose(p, slot, "fight")));
    const camera = combatFraming(staged[0], staged[1], 844 / 390);
    expect(camera.x).toBe(0);
    expect(saloonPose({ x: -3, y: .4, facing: -1 }, 0, "fight")).toEqual({ x: -3, y: .4, facing: -1 });
  });
  it("keeps both silhouettes within the view at arena edges, wide separation and jump height", () => {
    for (const aspect of [844 / 390, 1082 / 874, 390 / 844]) {
      for (const [left, right] of [[-4.4, -2.65], [2.65, 4.4], [-4.4, 4.4], [-0.875, 0.875]]) {
        for (const height of [0, 1.3]) {
          const frame = combatFraming({ x: left, y: height }, { x: right, y: 0 }, aspect);
          const camera = new PerspectiveCamera(frame.fov, aspect, 0.1, 250);
          camera.position.set(frame.x, frame.y, frame.z);
          camera.lookAt(frame.x, frame.lookY, 0);
          camera.updateMatrixWorld(true);
          // Conservative visible silhouette, including the overhead rival marker.
          for (const [x, jump] of [[left, height], [right, 0]]) {
            for (const dx of [-1.2, 1.2]) for (const y of [0, 3.3 + jump]) {
              const point = new Vector3(x + dx, y, 0.4).project(camera);
              expect(Math.abs(point.x)).toBeLessThan(0.87);
              expect(Math.abs(point.y)).toBeLessThan(0.85);
              expect(point.z).toBeGreaterThan(-1);
              expect(point.z).toBeLessThan(1);
            }
          }
        }
      }
    }
  });

  it("centres an edge duel on the pair and brings a close fight nearer than the former10.2m camera", () => {
    const frame = combatFraming({ x: -4.4, y: 0 }, { x: -2.65, y: 0 }, 844 / 390);
    expect(frame.x).toBeCloseTo(-3.525);
    expect(frame.z).toBeLessThan(10.2);
  });

  it("cuts between distinct worlds while preserving continuous countdown and duel cameras", () => {
    expect(sceneForPhase("race")).not.toBe(sceneForPhase("transition"));
    expect(sceneForPhase("fight")).not.toBe(sceneForPhase("results"));
    expect(sceneForPhase("countdown")).toBe(sceneForPhase("race"));
    expect(sceneForPhase("transition")).toBe(sceneForPhase("fight"));
  });
});

describe('cup ceremony composition', () => {
  it('keeps the winner and raised cup clear of landscape and portrait score cards', () => {
    for (const [width, height, left, top, cardWidth, cardHeight] of [
      [844, 390, 398, 41, 404, 336],
      [1082, 874, 518, 250, 510, 420],
      [390, 844, 19, 400, 352, 399],
    ]) for (const tie of [false, true]) {
      const panel = { left, top, width: cardWidth, height: cardHeight };
      const frame = resultsFraming(width, height, panel, tie);
      const camera = new PerspectiveCamera(frame.fov, width / height, .1, 250);
      camera.position.set(frame.position.x, frame.position.y, frame.position.z);
      camera.lookAt(frame.focus.x, frame.focus.y, frame.focus.z);
      camera.setViewOffset(width, height, frame.offsetX, frame.offsetY, width, height);
      camera.updateMatrixWorld(true);
      // Conservative world box covers winner meshes, tail and raised cup.
      for (const x of tie ? [-2.3, 2.3] : [-1.4, .4]) {
        for (const y of [.25, 3.35]) for (const z of [-1.1, 1.3]) {
          const point = new Vector3(x, y, z).project(camera);
          const px = (point.x + 1) * width / 2, py = (1 - point.y) * height / 2;
          expect(px).toBeGreaterThan(8); expect(px).toBeLessThan(width - 8);
          expect(py).toBeGreaterThan(56); expect(py).toBeLessThan(height - 24);
          expect(px < panel.left - 8 || py < panel.top - 8).toBe(true);
        }
      }
    }
  });
});


describe('race camera safe composition', () => {
 it('keeps the local silhouette visible from countdown through all bends and both lanes', () => {
  for(const aspect of [1280/720,844/390,667/375,390/844]) for(const z of [0,5,30,80,160,250,400,500]) for(const x of [-3.8,-1.25,1.25,3.8]) {
    const frame=raceFraming({x,z,speed:14},aspect); const camera=new PerspectiveCamera(frame.fov,aspect,.1,250);
    camera.position.set(frame.position.x,frame.position.y,frame.position.z); camera.lookAt(frame.target.x,frame.target.y,frame.target.z);camera.updateMatrixWorld(true);
    const center=Math.sin(z*.018)*22+Math.sin(z*.038)*5+x;
    for(const dx of [-1.1,1.1]) for(const y of [0,2.7]) for(const dz of [-1.3,1.3]) {
      const point=new Vector3(center+dx,y,z+dz).project(camera);
      expect(Math.abs(point.x)).toBeLessThan(.72);expect(point.y).toBeGreaterThan(-.60);expect(point.y).toBeLessThan(.72);
    }
  }
 });
});
