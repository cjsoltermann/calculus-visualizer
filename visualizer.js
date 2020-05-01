var currentTool;
var canvas;
var renderer;

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

function createCamera(fov, near, far) {
    const aspect = canvas.getBoundingClientRect().width / canvas.getBoundingClientRect().height;

    return new THREE.PerspectiveCamera(fov, aspect, near, far);
}

function createOrbitControls(tool, zoom=true, auto=false) {
    var controls = new THREE.OrbitControls( tool.camera, renderer.domElement );
    controls.enableDamping = true;
    controls.dampingFactor = 0.02;
    controls.rotateSpeed = 1.5;
    controls.autoRotate = auto;
    controls.autoRotateSpeed = 4;
    controls.enablePan = false;
    controls.enableZoom = zoom;
    return controls;
}

function toggleObject(value, scene, object) {
    if (value)
        scene.add(object);
    else
        scene.remove(object);
}

//Fill gui from blueprint and return dict with the items
function buildGui(gui, object, blueprint) {
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

window.cube = {
    controls: null,
    camera: null,
    scene: null,
};

cube.setup = function() {
    cube.camera = createCamera(75, 0.01, 5);
    cube.camera.position.z = 2;
    cube.camera.position.y = 1;

    cube.scene = new THREE.Scene();
    cube.scene.background = new THREE.Color(0xFFFFFF);
    cube.scene.add(cube.camera);

    cube.controls = createOrbitControls(cube, false, true);

    const boxDimensions = [1,1,1];
    const geometry = new THREE.BoxGeometry(boxDimensions[0],boxDimensions[1],boxDimensions[2]);
    const material = new THREE.MeshPhongMaterial({color: "#44AA88"});
    const cube_mesh = new THREE.Mesh(geometry, material);

    var cameraLight = new THREE.DirectionalLight("#FFFFFF", 1);
    cube.camera.add(cameraLight);
    var ambientLight = new THREE.AmbientLight( 0x404040, 2 );
    cube.scene.add(ambientLight);

    cube.camera.lookAt(cube_mesh);

    cube.scene.add(cube_mesh);
};

cube.load = function() {
    if (currentTool == cube) return;
    cube.setup();
    currentTool = cube;
};

cube.unload = function() {
    cube.controls.enabled = false;
};

window.rotation = {
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
//TODO: Don't regenerate shape to remove caps
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
    if (rotation.drawCaps)
    {
        var topRadius = transformedPoints[0].x;
        var bottomRadius = transformedPoints[transformedPoints.length - 1].x;

        if (topRadius > 0) {
            var topCap = new THREE.CircleGeometry(topRadius, rotation.detail, Math.PI / 2);
            var topMesh = new THREE.Mesh(topCap, material);
            topMesh.position.y = transformedPoints[0].y;
            topMesh.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
            mesh.add(topMesh);
        }

        if (bottomRadius > 0) {
            var bottomCap = new THREE.CircleGeometry(bottomRadius, rotation.detail, Math.PI / 2);
            var bottomMesh = new THREE.Mesh(bottomCap, material);
            bottomMesh.position.y = transformedPoints[transformedPoints.length - 1].y;
            bottomMesh.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
            mesh.add(bottomMesh);
        }
    }

    mesh.rotateOnAxis(new THREE.Vector3(0,0,1), -angle);
    mesh.position.sub(rotationPoint);
    return mesh;
}

function updateObject(tool, valueString, objectString, object) {
    if (tool[valueString]) {
        tool.scene.remove(tool[objectString]);
        tool[objectString] = object;
        tool.scene.add(tool[objectString]);
    }
    else
        tool[objectString] = object;
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

    guiItems.drawCaps.onChange(rotation.updateShape);
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

    rotation.grid = createGrid();
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

function createGrid() {
    var size = 2 * Math.max(30, rotation.rightBound, -rotation.leftBound, rotation.topBound, -rotation.bottomBound);
    var grid = new THREE.GridHelper(size, size);
    grid.rotation.x = Math.PI / 2;
    return grid;
}

function parseFunction(str) {
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

function plotFunction(str, color=0x000000, useBounds=true) {
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

function getFunctionPoints(func, useBounds) {
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

function createBoundSquare(tool) {
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

window.crossSection = {
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

    crossSection.grid = createGrid();
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
