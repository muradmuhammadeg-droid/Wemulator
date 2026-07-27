// ==========================================
// BACKGROUND LOADER LOGIC WITH WAD AUTO-BOOT
// ==========================================
(function() {
    // 1. Tell the browser where to find the WebAssembly file on GitHub Pages
    if (typeof Module !== 'undefined') {
        Module.locateFile = function(path) {
            if (path.endsWith('.wasm')) {
                return './wii_engine.wasm'; 
            }
            return path;
        };

        // Wait for WebAssembly compilation to complete
        Module.onRuntimeInitialized = bootWiiEmulatorFrontend;
    }

    // NEW AUTO-BOOT FUNCTION PLACE
    async function autoBootBundledWad() {
        console.log("Fetching bundled system menu firmware...");
        try {
            // Fetch the WAD file directly from your GitHub repository folder
            const response = await fetch('./Wii%20Menu%20(Europe)%20(v4.2).wad');
            const arrayBuffer = await response.arrayBuffer();
            const rawBytes = new Uint8Array(arrayBuffer);
            
            // Allocate and push directly to your compiled C++ core
            const wasmPointer = Module._malloc(rawBytes.length);
            Module.HEAPU8.set(rawBytes, wasmPointer);
            Module._loadWiiMenuWad(wasmPointer, rawBytes.length);
            Module._free(wasmPointer);
            
            console.log("Wii Menu auto-booted successfully!");
        } catch (err) {
            console.error("Failed to auto-load bundled WAD:", err);
        }
    }

    function bootWiiEmulatorFrontend() {
        const canvas = document.querySelector('canvas') || document.getElementById('wii-display');
        const fileInput = document.getElementById('wii-game-uploader');
        
        if (!canvas) {
            console.error("Wii Loader Error: Canvas element not detected on the page!");
            return;
        }

        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(canvas.width, canvas.height);
        
        // Initialize our compiled C++ Wii systems
        Module._initWiiSystem(canvas.width, canvas.height);
        
        // 2. TRIGGER THE AUTO-BOOT IMMEDIATELY AFTER INITIALIZATION
        autoBootBundledWad();

        const vramPointer = Module._getVramAddress();
        let currentTick = 0;

        // Core 60FPS Video Processing Frame Loop
        function runFrameUpdate() {
            currentTick++;
            Module._stepGPUFrame(currentTick);
            Module._stepWiiCPUCycles(1000); 

            const pixelBufferView = new Uint8Array(Module.HEAPU8.buffer, vramPointer, canvas.width * canvas.height * 4);
            imgData.data.set(pixelBufferView);
            ctx.putImageData(imgData, 0, 0);

            requestAnimationFrame(runFrameUpdate);
        }
        
        runFrameUpdate();

        // Optional manual upload backup listener (stays working)
        if (fileInput) {
            fileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = function(event) {
                    const rawBuffer = new Uint8Array(event.target.result);
                    const wasmBufferPointer = Module._malloc(rawBuffer.length);
                    Module.HEAPU8.set(rawBuffer, wasmBufferPointer);
                    Module._loadWiiMenuWad(wasmBufferPointer, rawBuffer.length);
                    Module._free(wasmBufferPointer);
                    console.error("Manual WAD pushed over auto-boot.");
                };
                reader.readAsArrayBuffer(file);
            });
        }
    }
})();
