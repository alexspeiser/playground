import './style.css'
import {
    AmbientLight, AnimationAction,
    AnimationClip,
    AnimationMixer, BoxGeometry, Clock, Color,
    DirectionalLight, Matrix4, Mesh, MeshStandardMaterial,
    PerspectiveCamera, PlaneGeometry, RepeatWrapping,
    Scene, ShaderMaterial, Texture, TextureLoader, Vector3,
    WebGLRenderer
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { CharacterControls } from "./controls/characterControls";
import { KeyDisplay } from "./controls/keyDisplay";
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

// init
// SCENE
const scene = new Scene();
scene.background = new Color(0xa8def0);

// CAMERA
const camera = new PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.set(0, 15, 50)

// RENDERER
const renderer = new WebGLRenderer( { antialias: true } );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

//CONTROLS
const orbitControls = new OrbitControls( camera, renderer.domElement );
orbitControls.enableDamping = true;
orbitControls.minDistance = 5;
orbitControls.maxDistance = 15;
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
orbitControls.update();

//LIGHT
generateLight();

//FLOOR
generateFloor();

//CLOCK
const clock = new Clock();

//GLTF character animation with controls
let characterControls: CharacterControls
const loader = new GLTFLoader();
loader.load( './src/models/soldier/soldier.glb', (gltf) => {
    const model = gltf.scene
    model.traverse((object: any) => {
        if (object.isMesh) object.castShadow = true
    })
    scene.add( model );

    const gltfAnimation: AnimationClip[] = gltf.animations
    const mixer = new AnimationMixer(model)
    const animationsMap: Map<string, AnimationAction> = new Map()
    gltfAnimation.filter((aclip: AnimationClip) => aclip.name !== 'TPose').forEach((aclip: AnimationClip) => {
        animationsMap.set(aclip.name, mixer.clipAction(aclip))
    })

    characterControls = new CharacterControls(model, mixer, animationsMap, orbitControls, camera,  'Idle')
});

//FBX monster idle animation
const fbxLoader = new FBXLoader()
let fbxMixer: AnimationMixer;
let modelReady: boolean = false;
fbxLoader.load(
    './src/models/monster/monster.fbx', (model) => {
        model.traverse((object: any) => {
            if (object.isMesh) object.castShadow = true
        })
        model.scale.set(.02, .02, .02);
        model.position.set(0, 0, -10)
        model.castShadow = true;
        scene.add(model)

        const animations: AnimationClip[] = model.animations
        fbxMixer = new AnimationMixer(model)
        const animationsMap: Map<string, AnimationAction> = new Map()
        animations.filter((aclip: AnimationClip) => aclip.name !== 'TPose').forEach((aclip: AnimationClip) => {
            animationsMap.set('Idle', fbxMixer.clipAction(aclip))
        })

        animationsMap.get('Idle')?.play();
        modelReady = true;

    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
    },
    (error) => {
        console.log(error)
    }
)

//Shader box
const rotationMatrix = new Matrix4();
rotationMatrix.makeRotationZ( Math.PI * 0.5);
rotationMatrix.makeRotationX( Math.PI * 0.5);
rotationMatrix.scale(new Vector3(0.5, 0.5, 0.5));


const uniformData = {
    u_time: {
        type: 'f',
        value: clock.getElapsedTime(),
    },
    rotationMatrix: {value: rotationMatrix},
    textureFlag: {type: 't', value: new TextureLoader().load('./src/textures/flag.jpg')}
};

const boxGeometry = new BoxGeometry(24, 12, 24, 48, 48, 48);
const boxMaterial = new ShaderMaterial({
    uniforms: uniformData,
    vertexShader: `
    uniform float u_time;
    uniform mat4 rotationMatrix;
    varying vec3 pos;
    varying vec2 vUv;
      void main()	{
        vec4 result;
        pos = position;
        vUv = uv;
        result = vec4(position.x, sin(position.z + u_time) + 150.0, position.z + 25.0, 1.0) * rotationMatrix;

        gl_Position = projectionMatrix
          * modelViewMatrix
          * result;
      }
      `,
    fragmentShader: `
    uniform float u_time;
    uniform sampler2D textureFlag;
    varying vec2 vUv;
    varying vec3 pos;
      void main() {
        gl_FragColor = texture2D(textureFlag, vUv);
      }
      `,
});
const boxMesh = new Mesh(boxGeometry, boxMaterial);
scene.add(boxMesh);

// CONTROL KEYS
const keysPressed = {  }
const keyDisplayQueue = new KeyDisplay();
document.addEventListener('keydown', (event) => {
    keyDisplayQueue.down(event.key)
    if (event.shiftKey && characterControls) {
        characterControls.switchRunToggle()
    } else {
        (keysPressed as any)[event.key.toLowerCase()] = true
    }
}, false);
document.addEventListener('keyup', (event) => {
    keyDisplayQueue.up(event.key);
    (keysPressed as any)[event.key.toLowerCase()] = false
}, false);

function animate() {
    let mixerUpdateDelta = clock.getDelta();
    if (characterControls) {
        characterControls.update(mixerUpdateDelta, keysPressed);
    }
    if (modelReady) fbxMixer.update(mixerUpdateDelta)
    uniformData.u_time.value = clock.getElapsedTime();
    orbitControls.update()
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

document.body.appendChild( renderer.domElement );
animate();

function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    keyDisplayQueue.updatePosition();
}

window.addEventListener("resize", onWindowResize)

function generateFloor() {
    // TEXTURES
    const textureLoader = new TextureLoader();
    //const placeholder = textureLoader.load('./src/textures/placeholder.png');
    const sandBaseColor = textureLoader.load('./src/textures/sand/Sand 002_COLOR.jpg');
    const sandNormalMap = textureLoader.load('./src/textures/sand/Sand 002_NRM.jpg');
    const sandHeightMap = textureLoader.load('./src/textures/sand/Sand 002_DISP.jpg');
    const sandAmbientOcclusion = textureLoader.load('./src/textures/sand/Sand 002_OCC.jpg');

    const WIDTH = 80
    const LENGTH = 80

    const geometry = new PlaneGeometry(WIDTH, LENGTH, 512, 512);
    const material = new MeshStandardMaterial(
        {
            map: sandBaseColor,
            normalMap: sandNormalMap,
            displacementMap: sandHeightMap, displacementScale: 0.1,
            aoMap: sandAmbientOcclusion
        })
    //const materialPlaceholder = new MeshPhongMaterial({ map: placeholder})

    wrapAndRepeatTexture(material.map!)

    const floor = new Mesh(geometry, material)
    floor.receiveShadow = true
    floor.rotation.x = - Math.PI / 2
    scene.add(floor)
}

function wrapAndRepeatTexture(map: Texture) {
    map.wrapS = map.wrapT = RepeatWrapping
    map.repeat.x = map.repeat.y = 10
}

function generateLight(){
    //AMBIENT
    const ambientLight = new AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight)

    //DIRECT
    const directLight = new DirectionalLight(0xffffff, 1);
    directLight.position.set(- 60, 100, - 10);
    directLight.castShadow = true;
    directLight.shadow.camera.top = 50;
    directLight.shadow.camera.bottom = - 50;
    directLight.shadow.camera.left = - 50;
    directLight.shadow.camera.right = 50;
    directLight.shadow.camera.near = 0.1;
    directLight.shadow.camera.far = 200;
    directLight.shadow.mapSize.width = 4096;
    directLight.shadow.mapSize.height = 4096;
    scene.add(directLight)
}
