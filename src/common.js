import * as THREE from "../node_modules/three/build/three.module.js";
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import {Parser} from "../node_modules/expr-eval/dist/index.mjs";

export function createCamera(fov, near, far) {
    const aspect = canvas.getBoundingClientRect().width / canvas.getBoundingClientRect().height;

    return new THREE.PerspectiveCamera(fov, aspect, near, far);
}

export function createOrbitControls(tool, zoom=true, auto=false) {
    var controls = new OrbitControls( tool.camera, renderer.domElement );
    controls.enableDamping = true;
    controls.dampingFactor = 0.02;
    controls.rotateSpeed = 1.5;
    controls.autoRotate = auto;
    controls.autoRotateSpeed = 4;
    controls.enablePan = false;
    controls.enableZoom = zoom;
    return controls;
}

export function toggleObject(value, scene, object) {
    if (value)
        scene.add(object);
    else
        scene.remove(object);
}

//Fill gui from blueprint and return dict with the items
export function buildGui(gui, object, blueprint) {
    var ret = {};

    var items = Object.entries(blueprint);
    for (let [key, value] of items) {
        if (typeof(value) == "string") {
            if (value[0] == "#")
                ret[key] = gui.addColor(object, key).name(value.slice(1));
            else
                ret[key] = gui.add(object, key).name(value);
        }
        else if (typeof(value) == "object") {
            ret[key] = buildGui(gui.addFolder(key), object, value);
        }
    }
    return ret;
}

export function createGrid(tool) {
    var size = 2 * Math.max(30, tool.rightBound, -tool.leftBound, tool.topBound, -tool.bottomBound);
    var grid = new THREE.GridHelper(size, size);
    grid.rotation.x = Math.PI / 2;
    return grid;
}

export function parseFunction(str) {
    var output = '';
    var startIndex = null;
    for (let i = 0; i < str.length; i++) {
        let char = str[i];
        if (char == 'x' || char == 'y')
            output = char;
        if (char == '=') {
            startIndex = i+1;
            break;
        }
    }
    // If we didn't find a x= or y=, just try to use the letter we found
    if (startIndex == null) {
        if (output == '')
            return null;
        output = (output == 'x') ? 'y' : 'x';
        startIndex = -1;
    }

    var input = (output == 'x') ? 'y' : 'x';

    try {
        var jsfunc = Parser.parse(str.substring(startIndex)).toJSFunction([input]);
    }
    catch(e) {
        return null;
    }
    return {output:output, func:jsfunc};
}

export function plotFunction(str, color=0x000000, useBounds=true) {
    var func = parseFunction(str);
    if (func == null) return null;

    var material = new THREE.LineBasicMaterial({
	      color: color
    });
    var points = getFunctionPoints(func, useBounds);

    var geometry = new THREE.BufferGeometry().setFromPoints( points );
    var mesh = new THREE.Line(geometry, material);
    return mesh;
}

export function getFunctionPoints(func, useBounds) {
    var points = [];
    var bounds = (useBounds) ? [currentTool.leftBound, currentTool.rightBound, currentTool.topBound, currentTool.bottomBound] : [-500, 500, 500, -500];

    if (func.output == 'y') {
        for (var x = bounds[0]; x <= bounds[1]; x += currentTool.step) {
            let out = func.func(x);
            if (isNaN(out)) continue;
            if (out < bounds[3] || out > bounds[2]) continue;
            points.push( new THREE.Vector3(x, out, 0));
        }
    }
    else if  (func.output == 'x') {
        for (var y = bounds[3]; y <= bounds[2]; y += currentTool.step) {
            let out = func.func(y);
            if (isNaN(out)) continue;
            if (out < bounds[0] || out > bounds[1]) continue;
            points.push( new THREE.Vector3(out, y, 0));
        }
    }
    return points;
}

export function createBoundSquare(tool) {
    var width = tool.rightBound - tool.leftBound;
    var height = tool.topBound - tool.bottomBound;
    var x = (tool.leftBound + tool.rightBound) / 2;
    var y = (tool.topBound + tool.bottomBound) / 2;
    var geometry = new THREE.PlaneGeometry(width, height);
    var material = new THREE.MeshPhongMaterial({
        color: new THREE.Color("yellow"),
        opacity: 0.5,
        transparent: true,
        side: THREE.DoubleSide,
    });
    var plane = new THREE.Mesh( geometry, material );
    plane.position.x = x;
    plane.position.y = y;
    return plane;
}

export function updateObject(tool, valueString, objectString, object) {
    if (tool[valueString]) {
        tool.scene.remove(tool[objectString]);
        tool[objectString] = object;
        tool.scene.add(tool[objectString]);
    }
    else
        tool[objectString] = object;
}

