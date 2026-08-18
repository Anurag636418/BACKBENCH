import * as THREE from 'three';
import gsap from 'gsap';

export class ClassroomScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  // Callbacks
  private onBookClick: () => void;
  private onResultReveal: (page: number, resultMsg: string) => void;
  private onAnimationComplete: () => void;

  // Book Hierarchy
  private bookRoot!: THREE.Group;
  private frontCoverPivot!: THREE.Group;
  private leftPageSurface!: THREE.Mesh;
  private rightPageSurface!: THREE.Mesh;

  // State
  private isAnimating: boolean = false;
  private resizeObserver: ResizeObserver;

  constructor(
    containerId: string, 
    onBookClick: () => void,
    onResultReveal: (page: number, resultMsg: string) => void,
    onAnimationComplete: () => void
  ) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);
    this.container = el;

    this.onBookClick = onBookClick;
    this.onResultReveal = onResultReveal;
    this.onAnimationComplete = onAnimationComplete;

    // 1. Setup Renderer
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height, false); // pass false to let CSS handle canvas style size
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    
    // CRITICAL FIX: Make canvas fill the container perfectly without causing scrollbar resize loops
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.display = 'block'; 
    this.container.appendChild(this.renderer.domElement);

    // 2. Setup Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#404a37'); // Safe solid background
    
    // Camera simulating seated at desk
    const aspect = height > 0 ? width / height : 1;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    
    if (aspect < 1) {
      this.camera.fov = 65;
      this.camera.position.set(0, 10, 14);
      this.camera.lookAt(0, 0, 1);
    } else {
      this.camera.fov = 45;
      this.camera.position.set(0, 8, 12); 
      this.camera.lookAt(0, 0, 2);
    }

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.buildEnvironment();
    this.buildBook();
    this.setupLighting();
    this.setupInteraction();

    // Start render loop
    this.renderer.setAnimationLoop(() => this.render());

    // Handle Resize
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  private buildEnvironment() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshStandardMaterial({ color: '#c8c0b0' });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4.5;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Back Wall
    const wallGeo = new THREE.PlaneGeometry(50, 20);
    const wallMat = new THREE.MeshStandardMaterial({ color: '#68775a' });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.z = -10;
    wall.position.y = 5;
    wall.receiveShadow = true;
    this.scene.add(wall);

    // Main Desk (where the book sits)
    const deskGeo = new THREE.BoxGeometry(14, 0.5, 9);
    const deskMat = new THREE.MeshStandardMaterial({ color: '#b08840' });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.set(0, -0.25, 2); // Surface is at y=0
    desk.receiveShadow = true;
    desk.castShadow = true;
    this.scene.add(desk);

    // Desk Legs
    const legGeo = new THREE.BoxGeometry(0.5, 4.25, 0.5);
    const legMat = new THREE.MeshStandardMaterial({ color: '#3c2408' });
    const positions = [[-6.5, -2.375, -2], [6.5, -2.375, -2], [-6.5, -2.375, 6], [6.5, -2.375, 6]];
    positions.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(pos[0], pos[1], pos[2]);
      leg.castShadow = true;
      this.scene.add(leg);
    });
  }

  private buildBook() {
    this.bookRoot = new THREE.Group();
    this.bookRoot.position.set(0, 0, 3);
    this.bookRoot.rotation.y = Math.PI * -0.02;

    const bookWidth = 3.5;
    const bookLength = 4.5;
    const coverThickness = 0.1;
    const pageBlockThickness = 0.4;

    const coverMat = new THREE.MeshStandardMaterial({ color: '#1E355C', roughness: 0.8 }); 
    const paperMatBlock = new THREE.MeshStandardMaterial({ color: '#F4EEE4', roughness: 0.9 }); 
    const paperMatLeft = new THREE.MeshStandardMaterial({ color: '#F4EEE4', roughness: 0.9 }); 
    const paperMatRight = new THREE.MeshStandardMaterial({ color: '#F4EEE4', roughness: 0.9 }); 

    // --- RIGHT SIDE (STATIC) ---
    // 1. Back Cover
    const backCover = new THREE.Mesh(new THREE.BoxGeometry(bookWidth, coverThickness, bookLength), coverMat);
    backCover.position.set(bookWidth / 2, coverThickness / 2, 0); // Bottom rests on y=0
    backCover.castShadow = true;
    this.bookRoot.add(backCover);

    // 2. Right Pages Block
    const rightPageBlock = new THREE.Mesh(new THREE.BoxGeometry(bookWidth - 0.1, pageBlockThickness, bookLength - 0.2), paperMatBlock);
    rightPageBlock.position.set((bookWidth - 0.1) / 2 + 0.1, coverThickness + pageBlockThickness / 2, 0);
    this.bookRoot.add(rightPageBlock);

    // 3. Right Page Surface (for texture)
    this.rightPageSurface = new THREE.Mesh(new THREE.PlaneGeometry(bookWidth - 0.1, bookLength - 0.2), paperMatRight);
    this.rightPageSurface.rotation.x = -Math.PI / 2;
    this.rightPageSurface.position.set((bookWidth - 0.1) / 2 + 0.1, coverThickness + pageBlockThickness + 0.005, 0);
    this.bookRoot.add(this.rightPageSurface);

    // --- SPINE ---
    const spine = new THREE.Mesh(new THREE.BoxGeometry(coverThickness * 2, coverThickness + pageBlockThickness * 2, bookLength), coverMat);
    spine.position.set(0, (coverThickness * 2 + pageBlockThickness * 2) / 2, 0);
    this.bookRoot.add(spine);

    // --- PIVOT HINGE ---
    this.frontCoverPivot = new THREE.Group();
    // Pivot exactly at the top of the right pages / center of the spine
    this.frontCoverPivot.position.set(0, coverThickness + pageBlockThickness, 0);
    this.bookRoot.add(this.frontCoverPivot);

    // --- LEFT SIDE (ROTATES WITH PIVOT) ---
    // Build the left side in the OPEN state (rotation = 0).
    // In OPEN state, left side lies flat on the desk, mirrored from right side.

    // 4. Front Cover (when open, rests flat on desk)
    const frontCover = new THREE.Mesh(new THREE.BoxGeometry(bookWidth, coverThickness, bookLength), coverMat);
    // Relative to pivot: pivot is at y = cover+page. Cover must reach y=0.
    frontCover.position.set(-bookWidth / 2, -pageBlockThickness - coverThickness / 2, 0);
    frontCover.castShadow = true;
    this.frontCoverPivot.add(frontCover);

    // 5. Left Pages Block
    const leftPageBlock = new THREE.Mesh(new THREE.BoxGeometry(bookWidth - 0.1, pageBlockThickness, bookLength - 0.2), paperMatBlock);
    leftPageBlock.position.set(-(bookWidth - 0.1) / 2 - 0.1, -pageBlockThickness / 2, 0);
    this.frontCoverPivot.add(leftPageBlock);

    // 6. Left Page Surface (for texture)
    this.leftPageSurface = new THREE.Mesh(new THREE.PlaneGeometry(bookWidth - 0.1, bookLength - 0.2), paperMatLeft);
    this.leftPageSurface.rotation.x = -Math.PI / 2;
    // Just 0.005 above the block face to prevent z-fighting
    this.leftPageSurface.position.set(-(bookWidth - 0.1) / 2 - 0.1, 0.005, 0);
    this.frontCoverPivot.add(this.leftPageSurface);

    // --- INITIAL STATE ---
    // Close the book by rotating the left side -180 degrees (so it passes OVER the book)
    this.frontCoverPivot.rotation.z = -Math.PI;

    this.scene.add(this.bookRoot);
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xfff0dd, 1.2);
    dirLight.position.set(5, 15, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);
  }

  private setupInteraction() {
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (this.isAnimating) return; 

      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObject(this.bookRoot, true);
      
      if (intersects.length > 0) {
        this.onBookClick();
      }
    });

    this.renderer.domElement.addEventListener('pointermove', (e) => {
        if (this.isAnimating) {
            this.renderer.domElement.style.cursor = 'default';
            return;
        }
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.bookRoot, true);
        this.renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
    });
  }

  private async generatePageTexture(side: 'left' | 'right', pageNum: number): Promise<THREE.Texture> {
    try {
      const templatePath = side === 'left' ? '/assets/template_physics_left.svg' : '/assets/template_physics_right.svg';
      const res = await fetch(templatePath);
      let svgText = await res.text();
      
      const xPos = side === 'left' ? "30" : "350";
      const anchor = side === 'left' ? 'start' : 'end';
      const pageTextStr = `<text x="${xPos}" y="450" font-family="sans-serif" font-size="20" font-weight="bold" fill="#333" text-anchor="${anchor}">PAGE ${pageNum}</text>`;
      svgText = svgText.replace('</svg>', `${pageTextStr}</svg>`);

      return new Promise((resolve) => {
        const img = new Image();
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 380 * 2; 
          canvas.height = 480 * 2;
          const ctx = canvas.getContext('2d')!;
          // Default cream color background just in case SVG is transparent
          ctx.fillStyle = '#F4EEE4';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.scale(2, 2);
          ctx.drawImage(img, 0, 0);
          
          const tex = new THREE.CanvasTexture(canvas);
          tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          URL.revokeObjectURL(url);
          resolve(tex);
        };
        img.onerror = () => resolve(new THREE.Texture()); // fallback empty texture
        img.src = url;
      });
    } catch (e) {
      console.error("Texture generation failed", e);
      return new THREE.Texture();
    }
  }

  public async playInteractionSequence(page: number, resultMsg: string) {
    if (this.isAnimating) return;
    this.isAnimating = true;

    // CRITICAL FIX: In Book Cricket, the score must consistently match the right-side page.
    // Therefore, whatever page number the server calculated the score from MUST be placed on the right.
    const rightPageNum = page;
    const leftPageNum = page > 1 ? page - 1 : 0;

    const [leftTex, rightTex] = await Promise.all([
      this.generatePageTexture('left', leftPageNum),
      this.generatePageTexture('right', rightPageNum)
    ]);

    (this.leftPageSurface.material as THREE.MeshStandardMaterial).map = leftTex;
    (this.leftPageSurface.material as THREE.MeshStandardMaterial).needsUpdate = true;
    (this.rightPageSurface.material as THREE.MeshStandardMaterial).map = rightTex;
    (this.rightPageSurface.material as THREE.MeshStandardMaterial).needsUpdate = true;

    const tl = gsap.timeline({
      onComplete: () => {
        this.isAnimating = false;
        this.onAnimationComplete();
      }
    });

    // A. Physical tap response
    tl.to(this.bookRoot.position, {
        y: this.bookRoot.position.y - 0.1,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut"
    });

    // B. Cover Opens
    tl.to(this.frontCoverPivot.rotation, {
      z: 0.05, 
      duration: 0.8,
      ease: "power2.inOut"
    }, "+=0.1");

    // Settle bounce
    tl.to(this.frontCoverPivot.rotation, {
      z: 0,
      duration: 0.2,
      ease: "power1.out"
    });

    // C. Fire Reveal Callback
    tl.call(() => {
        this.onResultReveal(page, resultMsg);
    });

    // D. Pause for player to read result
    tl.to({}, { duration: 1.5 });

    // E. Cover Closes
    tl.to(this.frontCoverPivot.rotation, {
      z: -Math.PI, // Close over the book!
      duration: 0.6,
      ease: "power2.in"
    });
    
    // F. Final settle
    tl.to(this.bookRoot.position, {
      y: this.bookRoot.position.y,
      duration: 0.1
    });
  }

  private resize() {
    if (!this.container || !this.camera || !this.renderer) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (width === 0 || height === 0) return; // Ignore invisible container
    
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.aspect = aspect;

    if (aspect < 1) {
      // Mobile / Portrait mode:
      // Narrow width means vertical FOV needs to be increased or camera moved back
      // so the horizontal width of the book still fits on screen.
      this.camera.fov = 65;
      this.camera.position.set(0, 10, 14);
      this.camera.lookAt(0, 0, 1);
    } else {
      // Desktop / Landscape mode:
      this.camera.fov = 45;
      this.camera.position.set(0, 8, 12);
      this.camera.lookAt(0, 0, 2);
    }

    this.camera.updateProjectionMatrix();
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose() {
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.container.innerHTML = ''; 
  }
}
