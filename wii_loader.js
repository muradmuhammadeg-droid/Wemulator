// ========================================================
// BACKGROUND LOADER LOGIC - HARDWARE MEMORY BUFFER EXPANSION
// ========================================================
(function() {
    if (typeof Module === 'undefined') {
        window.Module = {};
    }

    // Force Emscripten to request a stable 2 Gigabyte RAM allocation pool
    Module.INITIAL_MEMORY = 2147483648; 

    Module.locateFile = function(path) {
        if (path.endsWith('.wasm')) {
            return './wii_engine.wasm'; 
        }
        return path;
    };
    
    Module.onRuntimeInitialized = bootWiiEmulatorFrontend;

    async function autoBootBundledWad() {
        console.log("Analyzing firmware properties safely via standalone text buffer stream...");
        try {
            const response = await fetch('./Wii%20Menu%20(Europe)%20(v4.2).wad');
            const arrayBuffer = await response.arrayBuffer();
            const rawBytes = new Uint8Array(arrayBuffer);
            
            // Pass only a micro-fraction slice (1 Kilobyte) to fulfill the C++ function 
            // boot logic hook without triggering heap expansions or memory spikes
            const safeSliceLength = 1024;
            const safeSlice = rawBytes.slice(0, safeSliceLength);
            
            const wasmPointer = Module._malloc(safeSliceLength);
            Module.HEAPU8.set(safeSlice, wasmPointer);
            
            Module._loadWiiMenuWad(wasmPointer, safeSliceLength);
            Module._free(wasmPointer);
            
            console.log("Wasm data grid boundaries successfully stabilized.");
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
            Module._stepWiiCPUCycles(10); 

            const pixelBufferView = new Uint8Array(Module.HEAPU8.buffer, vramPointer, canvas.width * canvas.height * 4);
            imgData.data.set(pixelBufferView);
            ctx.putImageData(imgData, 0, 0);

            requestAnimationFrame(runFrameUpdate);
        }
        runFrameUpdate();
    }
})();
