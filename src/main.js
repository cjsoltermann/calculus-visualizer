import * as THREE from "../node_modules/three/build/three.module.js";
import { OrbitControls } from "../node_modules/three/examples/jsm/controls/OrbitControls.js";
import * as dat from "../node_modules/dat.gui/build/dat.gui.module.js";
import {Parser} from "../node_modules/expr-eval/dist/index.mjs";

import cube from "./cube.js";
import rotation from "./rotation.js";
import crossSection from "./crossSection.js";

window.currentTool = null;
window.canvas = null;
window.renderer = null;

function setup() {
    canvas = document.querySelector("#visualizer");

    canvas.width = canvas.getBoundingClientRect().width;
    canvas.height = canvas.getBoundingClientRect().height;

    renderer = new THREE.WebGLRenderer({canvas, antialias: true});

    window.addEventListener("resize", function() {
        canvas.width = canvas.getBoundingClientRect().width;
        canvas.height = canvas.getBoundingClientRect().height;
        currentTool.camera.aspect = canvas.getBoundingClientRect().width / canvas.getBoundingClientRect().height;
        currentTool.camera.updateProjectionMatrix();

        renderer.setSize(canvas.width, canvas.height, false);
    });
}

function mainLoop(time) {
    time *= 0.001;

    currentTool.controls.update();
    if (currentTool.loop)
        currentTool.loop(time);

    renderer.render(currentTool.scene, currentTool.camera);

    requestAnimationFrame(mainLoop);
}

window.onload = function() {
    setup();
    if (window.location.hash == "#rotation") {
        rotation.load();
    }
    else if (window.location.hash == "#crossSection") {
        crossSection.load();
    }
    else {
        cube.load();
    }
    requestAnimationFrame(mainLoop);
};

window.loadRotation = function() {
    rotation.load();
}

window.loadCrossSection = function() {
    crossSection.load();
}
