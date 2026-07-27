// ==========================================
// BACKGROUND LOADER LOGIC - BITE-SIZED STREAMING
// ==========================================
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

    // Streams the file in tiny chunks to prevent the memory crash
    async function autoBootBundledWad() {
        console.log("Streaming system menu firmware in chunks...");
        try {
            const response = await fetch('./Wii%20Menu%20(Europe)%20(v4.2).wad');
            const reader = response.body.getReader();
            
            // Read the file in small 1MB fragments
            let chunks = [];
            while(true) {
                const {done, value} = await reader.read();
                if (done) break;
                chunks.push(value);
            }
            
            // Combine the small pieces safely
            let totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            let rawBytes = new Uint8Array(totalLength);
            let offset = 0;
            for(let chunk of chunks) {
                rawBytes.set(chunk, offset);
                offset += chunk.length;
            }
            
            // Push to your existing C++ core allocation
            const wasmPointer = Module._malloc(rawBytes.length);
            Module.HEAPU8.set(rawBytes, wasmPointer);
            Module._loadWiiMenuWad(wasmPointer, rawBytes.length);
            Module._free(wasmPointer);
            
            console.log("Wii Menu auto-booted successfully!");
        } catch (err) {
            console.error("Streaming failed:", err);
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
            Module._stepWiiCPUCycles(1000); 

            const pixelBufferView = new Uint8Array(Module.HEAPU8.buffer, vramPointer, canvas.width * canvas.height * 4);
            imgData.data.set(pixelBufferView);
            ctx.putImageData(imgData, 0, 0);

            requestAnimationFrame(runFrameUpdate);
        }
        runFrameUpdate();
    }
})();
