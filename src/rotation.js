import * as THREE from "../node_modules/three/build/three.module.js";
import * as dat from "../node_modules/dat.gui/build/dat.gui.module.js";

import {createCamera, createOrbitControls, toggleObject, buildGui, createGrid, parseFunction, plotFunction, getFunctionPoints, createBoundSquare, updateObject} from "./common.js";

var rotation = {
    controls:null,
    gui:null,
    camera:null,
    scene:null,
    curve:null,
    axis:null,
    shape:null,
    grid:null,
    boundSquare:null,
    leftBound: -30,
    rightBound: 30,
    topBound: 30,
    bottomBound: -30,
    detail: 12,
    step: 0.1,
    curveFunc:"x^2",
    axisFunc:"x=0",
    drawShape: true,
    drawCurve: true,
    drawAxis: true,
    drawGrid: true,
    drawBounds: false,
    drawCaps: true,
    shapeColor: "#44aa88",
    curveColor: "#0000FF",
    axisColor: "#FF0000",
    resetCamera: function() {
        rotation.controls.enableDamping = false;
        rotation.controls.update();
        rotation.controls.enableDamping = true;
        rotation.controls.reset();
    },
    ready: false,
};

//TODO: Either use a webworker or timeouts to keep the frame from freezing up
//TODO: Stop using the lathe primitive and manually create geometry
//TODO: Multiple curves, use subtraction
function solidOfRevolution(curve, axis) {
    var curveFunc = parseFunction(curve);
    var axisFunc = parseFunction(axis);
    if (curveFunc == null || axisFunc == null) return null;

    var material = new THREE.MeshPhongMaterial({
        color: rotation.shapeColor,
        side: THREE.DoubleSide,
    });

    var curvePoints = getFunctionPoints(curveFunc, true);

    //Assume axis is linear and calculate angle
    //If it's not linear, the secant line from 0 to 1 (x or y) is used instead
    var slope = axisFunc.func(1) - axisFunc.func(0);
    var angle = (axisFunc.output == 'x') ? Math.atan(slope) : (Math.PI / 2 - Math.atan(slope));

    var transformedPoints = [];

    //Use axis intercept as rotation axis
    var rotationPoint = (axisFunc.output == 'x') ? new THREE.Vector3(-axisFunc.func(0), 0, 0) : new THREE.Vector3(0, -axisFunc.func(0), 0);


    //Rotate curve points
    for (let point of curvePoints) {
        let nextPoint = point.add(rotationPoint);
        nextPoint = point.applyAxisAngle(new THREE.Vector3(0,0,1), angle);
        transformedPoints.push(nextPoint);
    }

    var geometry = new THREE.LatheGeometry(transformedPoints, rotation.detail);
    var mesh = new THREE.Mesh(geometry, material);

    //Create Caps
    var topRadius = transformedPoints[0].x;
    var bottomRadius = transformedPoints[transformedPoints.length - 1].x;

    if (topRadius != 0) {
        var topCap = new THREE.CircleGeometry(topRadius, rotation.detail, Math.PI / 2);
        var topMesh = new THREE.Mesh(topCap, material);
        topMesh.position.y = transformedPoints[0].y;
        topMesh.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        rotation.topCap = topMesh;
        if (rotation.drawCaps) mesh.add(topMesh);
    }

    if (bottomRadius != 0) {
        var bottomCap = new THREE.CircleGeometry(bottomRadius, rotation.detail, Math.PI / 2);
        var bottomMesh = new THREE.Mesh(bottomCap, material);
        bottomMesh.position.y = transformedPoints[transformedPoints.length - 1].y;
        bottomMesh.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        rotation.bottomCap = bottomMesh;
        if (rotation.drawCaps) mesh.add(bottomMesh);
    }

    mesh.rotateOnAxis(new THREE.Vector3(0,0,1), -angle);
    mesh.position.sub(rotationPoint);
    return mesh;
}

rotation.updateShape = function() {
    var newShape = solidOfRevolution(rotation.curveFunc, rotation.axisFunc);
    updateObject(rotation, "drawShape", "shape", newShape);
};

rotation.updateCurve = function() {
    var newCurve = plotFunction(rotation.curveFunc, rotation.curveColor);
    updateObject(rotation, "drawCurve", "curve", newCurve);
    rotation.updateShape();
};

rotation.updateAxis = function() {
    var newAxis = plotFunction(rotation.axisFunc, rotation.axisColor);
    updateObject(rotation, "drawAxis", "axis", newAxis);
    rotation.updateShape();
};

rotation.updateBounds = function() {
    var newBounds = createBoundSquare(rotation);
    updateObject(rotation, "drawBounds", "boundSquare", newBounds);
    rotation.updateCurve();
    rotation.updateShape();
};

rotation.setup = function() {
    if (rotation.ready) return;

    rotation.camera = createCamera(75, 0.01, 1000);
    rotation.camera.position.z = 15;

    rotation.scene = new THREE.Scene();
    rotation.scene.background = new THREE.Color(0xFFFFFF);
    rotation.scene.add(rotation.camera);

    rotation.controls = createOrbitControls(rotation);

    rotation.gui = new dat.GUI({ autoPlace: false });
    rotation.gui.close();
    canvas.parentNode.appendChild(rotation.gui.domElement);

    var blueprint = {
        "curveFunc": "Curve",
        "axisFunc": "Axis",
        "detail": "Detail",
        "step": "Step",
        "drawShape": "Draw Shape",
        "drawCaps": "Draw Caps",
        "drawCurve": "Draw Curve",
        "drawAxis": "Draw Axis",
        "drawGrid": "Draw Grid",
        "drawBounds": "Draw Bounds",
        "resetCamera": "Reset Camera",
        "Colors": {
            "shapeColor": "#Shape Color",
            "curveColor": "#Curve Color",
            "axisColor": "#Axis Color",
        },
        "Bounds": {
            "leftBound": "Left",
            "rightBound": "Right",
            "topBound": "Top",
            "bottomBound": "Bottom",
        },
    };

    var guiItems = buildGui(rotation.gui, rotation, blueprint);

    guiItems.drawShape.onChange(function(value){
        toggleObject(value, rotation.scene, rotation.shape);
    });
    guiItems.drawCurve.onChange(function(value){
        toggleObject(value, rotation.scene, rotation.curve);
    });
    guiItems.drawAxis.onChange(function(value){
        toggleObject(value, rotation.scene, rotation.axis);
    });
    guiItems.drawGrid.onChange(function(value){
        toggleObject(value, rotation.scene, rotation.grid);
    });
    guiItems.drawBounds.onChange(function(value){
        toggleObject(value, rotation.scene, rotation.boundSquare);
    });
    guiItems.drawCaps.onChange(function(value){
        toggleObject(value, rotation.shape, rotation.topCap);
        toggleObject(value, rotation.shape, rotation.bottomCap);
    });

    // guiItems.drawCaps.onChange(rotation.updateShape);
    guiItems.step.onFinishChange(rotation.updateCurve);
    guiItems.detail.onFinishChange(rotation.updateShape);

    guiItems.curveFunc.onFinishChange(rotation.updateCurve);
    guiItems.axisFunc.onFinishChange(rotation.updateAxis);

    guiItems.Colors.shapeColor.onChange(function(value) {
        rotation.shape.material.color.set(value);
    });
    guiItems.Colors.curveColor.onChange(function(value) {
        rotation.curve.material.color.set(value);
    });
    guiItems.Colors.axisColor.onChange(function(value) {
        rotation.axis.material.color.set(value);
    });

    for (let item in guiItems.Bounds) {
        guiItems.Bounds[item].onFinishChange(rotation.updateBounds);
    }

    var cameraLight = new THREE.DirectionalLight("#FFFFFF", 1);
    rotation.camera.add(cameraLight);
    var ambientLight = new THREE.AmbientLight( 0x404040, 2 );
    rotation.scene.add(ambientLight);

    rotation.grid = createGrid(rotation);
    rotation.scene.add(rotation.grid);

    rotation.curve = plotFunction(rotation.curveFunc, rotation.curveColor);
    rotation.scene.add(rotation.curve);

    rotation.shape = solidOfRevolution(rotation.curveFunc, rotation.axisFunc);
    rotation.scene.add(rotation.shape);

    rotation.axis = plotFunction(rotation.axisFunc, rotation.axisColor, false);
    rotation.scene.add(rotation.axis);

    rotation.boundSquare = createBoundSquare(rotation);
    //rotation.scene.add(rotation.boundSquare);

    rotation.ready = true;
};

rotation.load = function() {
    if (currentTool == rotation) return;
    if (currentTool) currentTool.unload();

    window.location.hash = "rotation";
    currentTool = rotation;

    if (!rotation.ready) rotation.setup();

    document.getElementById("rotationNotes").style.display = "block";
    rotation.gui.show();

    rotation.controls.enabled = true;
};

rotation.unload = function() {
    document.getElementById("rotationNotes").style.display = "none";
    rotation.gui.hide();
    rotation.controls.enabled = false;
};

export {rotation as default};
