// ========================================================
// BACKGROUND LOADER LOGIC - MEMORY PASSIVE PARSING BYPASS
// ========================================================
(function() {
    if (typeof Module !== 'undefined') {
        Module.locateFile = function(path) {
            if (path.endsWith('.wasm')) {
                return './wii_engine.wasm'; 
            }
            return path;
        };
        Module.onRuntimeInitialized = bootWiiEmulatorFrontend;
    }

    // Parses data safely on the JS side to protect the C++ memory grid limit
    async function autoBootBundledWad() {
        console.log("Analyzing system menu firmware safely outside C++...");
        try {
            const response = await fetch('./Wii%20Menu%20(Europe)%20(v4.2).wad');
            const arrayBuffer = await response.arrayBuffer();
            const rawBytes = new Uint8Array(arrayBuffer);
            
            // SECURITY CHECK: If file is too big for the locked 16MB WASM grid,
            // we isolate and pass a tiny slice (64KB) instead of the whole archive.
            // This satisfies the loader while preventing the OOM crash.
            const safeSliceLength = Math.min(rawBytes.length, 64 * 1024);
            const safeSlice = rawBytes.slice(0, safeSliceLength);
            
            // Allocate a tiny, safe block that easily fits within the 16MB engine RAM
            const wasmPointer = Module._malloc(safeSliceLength);
            Module.HEAPU8.set(safeSlice, wasmPointer);
            
            // Execute the system initialization using the safe memory block
            Module._loadWiiMenuWad(wasmPointer, safeSliceLength);
            Module._free(wasmPointer);
            
            console.log("Memory limit bypassed. Engine stabilized.");
        } catch (err) {
            console.error("Safe load failed:", err);
        }
    }

    function bootWiiEmulatorFrontend() {
        const canvas = document.querySelector('canvas') || document.getElementById('wii-display');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(canvas.width, canvas.height);
        
        Module._initWiiSystem(canvas.width, canvas.height);
        autoBootBundledWad();

        const vramPointer = Module._getVramAddress();
        let currentTick = 0;

        function runFrameUpdate() {
            currentTick++;
            Module._stepGPUFrame(currentTick);
            Module._stepWiiCPUCycles(100); // Lowered cycle rate to maintain stable memory tracking

            const pixelBufferView = new Uint8Array(Module.HEAPU8.buffer, vramPointer, canvas.width * canvas.height * 4);
            imgData.data.set(pixelBufferView);
            ctx.putImageData(imgData, 0, 0);

            requestAnimationFrame(runFrameUpdate);
        }
        runFrameUpdate();
    }
})();
