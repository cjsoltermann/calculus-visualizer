import * as THREE from "../node_modules/three/build/three.module.js";
import * as dat from "../node_modules/dat.gui/build/dat.gui.module.js";

import {createCamera, createOrbitControls, toggleObject, buildGui, createGrid, parseFunction, plotFunction, getFunctionPoints, createBoundSquare, updateObject} from "./common.js";

var crossSection = {
    controls:null,
    gui:null,
    camera:null,
    scene:null,
    curve:null,
    shape:null,
    grid:null,
    boundSquare:null,
    leftBound: -30,
    rightBound: 30,
    topBound: 30,
    bottomBound: -30,
    detail: 12,
    step: 0.1,
    curveFunc:"10 * (1.1)^(-(x^2))",
    axisFunc:"x=0",
    drawShape: true,
    drawCurve: true,
    drawGrid: true,
    drawBounds: false,
    drawCaps: true,
    shapeColor: "#44aa88",
    curveColor: "#0000FF",
    resetCamera: function() {
        crossSection.controls.enableDamping = false;
        crossSection.controls.update();
        crossSection.controls.enableDamping = true;
        crossSection.controls.reset();
    },
    ready: false,
};

//NOTE Y coordinates are backwards because of the OrbitContols. Down is up
//     Also the plane is sideways, so y=z
function solidOfKnownCrossSection(curve) {
    //for now use x-axis and triangles
    var curveFunc = parseFunction(curve);

    var diffStr = curve.concat("-x");
    var diffFunc = parseFunction(diffStr);
    if (diffFunc == null || curveFunc == null) return null;

    var curvePoints = getFunctionPoints(curveFunc, true);
    var diffPoints = getFunctionPoints(diffFunc, true);

    //Equilateral triangle height = sqrt(3)/2 * x
    var geometry = new THREE.Geometry();
    for (let i = 0; i < curvePoints.length; i++) {
        let point = curvePoints[i];
        let x = curvePoints[i].x;
        let y = curvePoints[i].y;
        geometry.vertices.push(point);
        geometry.vertices.push(new THREE.Vector3(x, 0, 0));
        geometry.vertices.push(new THREE.Vector3(x, y / 2, (Math.sqrt(3) / 2) * y));
    }

    for (let i = 0; i < geometry.vertices.length - 6; i += 3) {
        // Bottom
        geometry.faces.push(new THREE.Face3(i + 0, i + 3, i + 1));
        geometry.faces.push(new THREE.Face3(i + 1, i + 3, i + 4));
        //Curve to top
        geometry.faces.push(new THREE.Face3(i + 0, i + 2, i + 3));
        geometry.faces.push(new THREE.Face3(i + 2, i + 5, i + 3));
        //Top to zero
        geometry.faces.push(new THREE.Face3(i + 1, i + 4, i + 2));
        geometry.faces.push(new THREE.Face3(i + 2, i + 4, i + 5));
    }

    geometry.computeFaceNormals();

    var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({color: crossSection.shapeColor, side: THREE.DoubleSide }));
    //var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({color: crossSection.shapeColor, side: THREE.FrontSide }));
    mesh.rotation.x = -Math.PI / 2;
    //var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({color: "red", side: THREE.DoubleSide }));
    //var mesh = new THREE.Points(geometry, new THREE.PointsMaterial( { color: 0x888888, size: 0.3 } ));
    return mesh;
}

crossSection.updateShape = function() {
    var newShape = solidOfKnownCrossSection(crossSection.curveFunc);
    updateObject(crossSection, "drawShape", "shape", newShape);
};

crossSection.updateCurve = function() {
    var newCurve = plotFunction(crossSection.curveFunc, crossSection.curveColor);
    newCurve.rotation.x = -Math.PI / 2;
    updateObject(crossSection, "drawCurve", "curve", newCurve);
    crossSection.updateShape();
};

crossSection.updateBounds = function() {
    var newBounds = createBoundSquare(crossSection);
    newBounds.rotation.x = -Math.PI / 2;
    updateObject(crossSection, "drawBounds", "boundSquare", newBounds);
    crossSection.updateCurve();
    crossSection.updateShape();
};

crossSection.setup = function () {
    if (crossSection.ready) return;

    crossSection.camera = createCamera(75, 0.01, 1000);

    crossSection.camera.position.y = 20;

    crossSection.scene = new THREE.Scene();
    crossSection.scene.background = new THREE.Color(0xFFFFFF);
    crossSection.scene.add(crossSection.camera);

    crossSection.controls = createOrbitControls(crossSection);

    crossSection.gui = new dat.GUI({ autoPlace: false });
    crossSection.gui.close();
    canvas.parentNode.appendChild(crossSection.gui.domElement);

    var blueprint = {
        "curveFunc": "Curve",
        "detail": "Detail",
        "step": "Step",
        "drawShape": "Draw Shape",
        "drawCaps": "Draw Caps",
        "drawCurve": "Draw Curve",
        "drawGrid": "Draw Grid",
        "drawBounds": "Draw Bounds",
        "resetCamera": "Reset Camera",
        "Colors": {
            "shapeColor": "#Shape Color",
            "curveColor": "#Curve Color",
        },
        "Bounds": {
            "leftBound": "Left",
            "rightBound": "Right",
            "topBound": "Top",
            "bottomBound": "Bottom",
        },
    };

    var guiItems = buildGui(crossSection.gui, crossSection, blueprint);

    guiItems.drawShape.onChange(function(value){
        toggleObject(value, crossSection.scene, crossSection.shape);
    });
    guiItems.drawCurve.onChange(function(value){
        toggleObject(value, crossSection.scene, crossSection.curve);
    });
    guiItems.drawGrid.onChange(function(value){
        toggleObject(value, crossSection.scene, crossSection.grid);
    });
    guiItems.drawBounds.onChange(function(value){
        toggleObject(value, crossSection.scene, crossSection.boundSquare);
    });

    guiItems.drawCaps.onChange(crossSection.updateShape);
    guiItems.step.onFinishChange(crossSection.updateCurve);
    guiItems.detail.onFinishChange(crossSection.updateShape);

    guiItems.curveFunc.onFinishChange(crossSection.updateCurve);

    guiItems.Colors.shapeColor.onChange(function(value) {
        crossSection.shape.material.color.set(value);
    });
    guiItems.Colors.curveColor.onChange(function(value) {
        crossSection.curve.material.color.set(value);
    });

    for (let item in guiItems.Bounds) {
        guiItems.Bounds[item].onFinishChange(crossSection.updateBounds);
    }

    var cameraLight = new THREE.DirectionalLight("#FFFFFF", 1);
    crossSection.camera.add(cameraLight);
    var ambientLight = new THREE.AmbientLight( 0x404040, 2 );
    crossSection.scene.add(ambientLight);

    crossSection.grid = createGrid(crossSection);
    crossSection.grid.rotation.x = 0;
    crossSection.scene.add( crossSection.grid );

    crossSection.curve = plotFunction(crossSection.curveFunc, crossSection.curveColor);
    crossSection.curve.rotation.x = -Math.PI / 2;
    crossSection.scene.add(crossSection.curve);

    crossSection.shape = solidOfKnownCrossSection(crossSection.curveFunc);
    crossSection.scene.add(crossSection.shape);

    crossSection.boundSquare = createBoundSquare(crossSection);
    crossSection.boundSquare.rotation.x = -Math.PI / 2;

    crossSection.ready = true;
};

crossSection.load = function() {
    if (currentTool == crossSection) return;
    if (currentTool) currentTool.unload();

    window.location.hash = "crossSection";
    currentTool = crossSection;

    if (!crossSection.ready) crossSection.setup();

    document.getElementById("crossSectionNotes").style.display = "block";
    crossSection.gui.show();

    crossSection.controls.enabled = true;

};

crossSection.unload = function() {
    document.getElementById("crossSectionNotes").style.display = "none";
    crossSection.gui.hide();
    crossSection.controls.enabled = false;
};

export {crossSection as default};
