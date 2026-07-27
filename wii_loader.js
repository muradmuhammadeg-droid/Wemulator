// ==========================================
// BACKGROUND LOADER LOGIC (UNTOUCHED HTML HOOK)
// ==========================================
(function() {
    window.addEventListener('DOMContentLoaded', () => {
        // Wait for the WebAssembly module compilation to complete
        if (typeof Module !== 'undefined') {
            Module.onRuntimeInitialized = bootWiiEmulatorFrontend;
        }
    });

    function bootWiiEmulatorFrontend() {
        // Automatically hook onto whatever canvas element exists on your page
        const canvas = document.querySelector('canvas');
        const fileInput = document.querySelector('input[type="file"]');
        
        if (!canvas) {
            console.error("Wii Loader Error: Canvas element not detected on the page!");
            return;
        }

        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(canvas.width, canvas.height);
        
        // Initialize our compiled C++ Wii systems (Width, Height)
        Module._initWiiSystem(canvas.width, canvas.height);
        
        // Get the structural memory address pointer where the C++ VRAM array sits
        const vramPointer = Module._getVramAddress();
        let currentTick = 0;

        // --- Core 60FPS Video Processing Frame Loop ---
        function runFrameUpdate() {
            currentTick++;
            
            // 1. Step the GPU calculation pipeline inside the WASM core
            Module._stepGPUFrame(currentTick);
            
            // 2. Advance the PowerPC CPU instruction processing blocks
            Module._stepWiiCPUCycles(1000); 

            // 3. Read the raw pixels straight out of the compiled memory stack
            const pixelBufferView = new Uint8Array(Module.HEAPU8.buffer, vramPointer, canvas.width * canvas.height * 4);
            
            // 4. Paint the buffer data array back onto your display
            imgData.data.set(pixelBufferView);
            ctx.putImageData(imgData, 0, 0);

            requestAnimationFrame(runFrameUpdate);
        }
        
        runFrameUpdate();

        // --- Automated WAD File Upload Listener ---
        if (fileInput) {
            fileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = function(event) {
                    const rawBuffer = new Uint8Array(event.target.result);
                    
                    // Allocate memory space directly inside the WebAssembly heap layout
                    const bufferLength = rawBuffer.length;
                    const wasmBufferPointer = Module._malloc(bufferLength);
                    
                    // Copy your local WAD bytes into the compiled C++ allocation space
                    Module.HEAPU8.set(rawBuffer, wasmBufferPointer);
                    
                    // Execute the C++ Stage 2 and Stage 3 European WAD boot loaders!
                    Module._loadWiiMenuWad(wasmBufferPointer, bufferLength);
                    
                    // Clean up and release the allocated heap memory safely
                    Module._free(wasmBufferPointer);
                    console.log("Wii Menu (Europe) (v4.2).wad successfully pushed to CPU pipeline.");
                };
                reader.readAsArrayBuffer(file);
            });
        }
    }
})();
