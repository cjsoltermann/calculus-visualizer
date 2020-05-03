import * as THREE from "../node_modules/three/build/three.module.js";
import {createCamera, createOrbitControls} from "./common.js";

var cube = {
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

export {cube as default};
