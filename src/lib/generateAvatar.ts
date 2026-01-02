export const generateAvatar = (seed: string): string => {
    // 1. Robust Hash Function (MurmurHash3-like or FNV-1a)
    const fnv1a = (str: string) => {
        let hash = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        return hash >>> 0;
    };

    // 2. Random Number Generator (seeded)
    const mulberry32 = (a: number) => {
        return () => {
            let t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    };

    const hashVal = fnv1a(seed);
    const random = mulberry32(hashVal);

    // 3. Vibrant Gradient Palettes (High Contrast & Fluid)
    const palettes = [
        ["#4158D0", "#C850C0", "#FFCC70"], // 0: Peach/Purple/Blue
        ["#0093E9", "#80D0C7", "#ffffff"], // 1: Cyan/White
        ["#8EC5FC", "#E0C3FC", "#FFFFFF"], // 2: Lavender/Blue
        ["#D9AFD9", "#97D9E1", "#FFFFFF"], // 3: Pink/Teal
        ["#FBAB7E", "#F7CE68", "#FFFFFF"], // 4: Sunset
        ["#85FFBD", "#FFFB7D", "#FFFFFF"], // 5: Lime/Yellow
        ["#FF9A9E", "#FECFEF", "#FFFFFF"], // 6: Warm Pink
        ["#FA8BFF", "#2BD2FF", "#2BFF88"], // 7: Neon
        ["#FF3CAC", "#784BA0", "#2B86C5"], // 8: Berry
        ["#21D4FD", "#B721FF", "#FFFFFF"]  // 9: Electric
    ];

    const palette = palettes[Math.floor(random() * palettes.length)];

    // 4. Generate Organic Blob Paths
    // We create a "blob" by connecting random points around a circle with Bezier curves
    const generateBlob = (cx: number, cy: number, size: number, complexity: number, irregularity: number) => {
        const points = [];
        const angleStep = (Math.PI * 2) / complexity;

        for (let i = 0; i < complexity; i++) {
            const angle = (i * angleStep) + (random() * 0.2); // slight angle jitter
            const dist = size * (0.8 + (random() * irregularity)); // varying radius
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            points.push({ x, y });
        }

        // Generate Path Command (Smooth Catmull-Rom or Quadratic approximations)
        // Simple Quadratic Bezier loop
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length; i++) {
            const p0 = points[i];
            const p1 = points[(i + 1) % points.length];
            // Control point is halfway between
            const cpX = (p0.x + p1.x) / 2;
            const cpY = (p0.y + p1.y) / 2;
            // For a smooth blob, we actually curve TO the midpoint, using the point as control? 
            // Better: use midpoints as knots and P_i as controls.
            // Simplified: Quadratic curve to next point midpoint
        }

        // Easier: Cubic Bezier smoothing
        // Let's create a smooth path string manually
        // Start from midpoint of last and first
        const pLast = points[points.length - 1];
        const pFirst = points[0];
        const midX = (pLast.x + pFirst.x) / 2;
        const midY = (pLast.y + pFirst.y) / 2;
        d = `M ${midX} ${midY}`;

        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const nextMidX = (p1.x + p2.x) / 2;
            const nextMidY = (p1.y + p2.y) / 2;
            d += ` Q ${p1.x} ${p1.y} ${nextMidX} ${nextMidY}`;
        }

        return d;
    };

    // Generate 3-5 layers of blobs
    const layerCount = 3 + Math.floor(random() * 3);
    let layersSvg = "";

    // Background Rect
    layersSvg += `<rect width="100" height="100" fill="${palette[0]}" />`;

    for (let i = 0; i < layerCount; i++) {
        const color = palette[Math.floor(random() * palette.length)];
        const size = 30 + (random() * 40);
        const x = 20 + (random() * 60);
        const y = 20 + (random() * 60);
        const complexity = 3 + Math.floor(random() * 3); // 3-5 points
        const opacity = 0.5 + (random() * 0.5);

        const path = generateBlob(x, y, size, complexity, 0.4);

        // Random blend modes or just opacity
        layersSvg += `<path d="${path}" fill="${color}" fill-opacity="${opacity}" style="mix-blend-mode: multiply;" />`;
    }

    // Overlay a Gradient for unification
    const gradId = `grad_${hashVal}`;
    const filterId = `noise_${hashVal}`;

    const svg = `
    <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="${filterId}">
                <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
                <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" />
                <feComposite operator="in" in2="SourceGraphic" result="startNoise" />
                <feBlend mode="overlay" in="startNoise" in2="SourceGraphic" />
            </filter>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                 <stop offset="0%" style="stop-color:${palette[0]}00" />
                 <stop offset="100%" style="stop-color:${palette[palette.length - 1]}66" />
            </linearGradient>
        </defs>
        
        <g filter="url(#${filterId})">
            ${layersSvg}
            <rect width="100" height="100" fill="url(#${gradId})" />
        </g>
    </svg>
    `.trim();

    return `data:image/svg+xml;base64,${btoa(svg)}`;
};
