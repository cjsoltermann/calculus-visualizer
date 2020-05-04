import * as THREE from "../node_modules/three/build/three.module.js";
import * as dat from "../node_modules/dat.gui/build/dat.gui.module.js";

import {createCamera, createOrbitControls, toggleObject, buildGui, createGrid, parseFunction, plotFunction, getFunctionPoints, createBoundSquare, updateObject} from "./common.js";

const CROSS_SECTION = {
    EQUALATERAL_TRIANGLE: 0,
    ISOSCELES_LEG_DOWN: 1,
    ISOSCELES_HYPOTENUSE_DOWN: 2,
    SQUARE: 3,
    SEMI_CIRCLE: 4,
};

const CROSS_SECTION_FUNCTIONS = [
    //Equalateral
    function(x) {
        return [[x / 2, (Math.sqrt(3) / 2) * x]];
    },
    //Isosceles (Leg down)
    function(x) {
        return [[0,x]];
    },
    //Isosceles (Hypotenuse down)
    function(x) {
        return [[x/2,x/2]];
    },
    //Square
    function(x) {
        return [[0,x],[x,x]];
    },
    //Semi-Circle
    function(x) {
        var ret = [];
        for (let i = 0; i <= crossSection.detail; i++) {
            // Add detail points evenly spaced
            // The height of each point is found using the function Math.sqrt(radius * x - x * x)
            // Radius is the argument, x is the x value of the pushed point
            ret.push([
                x*i/crossSection.detail,
                Math.sqrt((x * x * i / crossSection.detail) - Math.pow(x * i / crossSection.detail, 2))
            ]);
        }
        return ret;
    },
];

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
    crossSection: CROSS_SECTION.EQUALATERAL_TRIANGLE,
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
        //geometry.vertices.push(new THREE.Vector3(x, y / 2, (Math.sqrt(3) / 2) * y));
        var coords = CROSS_SECTION_FUNCTIONS[crossSection.crossSection](y);
        for (let coord of coords) {
            geometry.vertices.push(new THREE.Vector3(x, coord[0], coord[1]));
        }
    }

    var slicePointCount = CROSS_SECTION_FUNCTIONS[crossSection.crossSection](0).length + 2;

    for (let i = 0; i < geometry.vertices.length - slicePointCount * 2; i += 1) {
        geometry.faces.push(new THREE.Face3(i + 0, i + 1, i + slicePointCount));
        geometry.faces.push(new THREE.Face3(i + slicePointCount, i + slicePointCount + 1, i + 1));
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
        "crossSection": ["Cross Section",
            {
                "Equalateral Triangle": 0,
                "Isosceles Right Triangle (Leg as base)": 1,
                "Isosceles Right Triangle (Hypotenuse as base)": 2,
                "Square": 3,
                "Semi-Circle": 4
            }
        ],
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
    guiItems.crossSection.onChange(crossSection.updateShape);

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
