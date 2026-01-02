export const generateAvatar = (seed: string): string => {
    // Simple hash function to generate deterministic numbers from seed
    const hash = (str: string) => {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        }
        return h;
    };

    const h = Math.abs(hash(seed));

    // Curated emerald/teal based color palette to match theme
    const bgColors = [
        ["#ecfdf5", "#059669"], // Emerald 50/600
        ["#f0fdf4", "#16a34a"], // Green 50/600
        ["#f0f9ff", "#0284c7"], // Sky 50/600
        ["#eff6ff", "#2563eb"], // Blue 50/600
        ["#faf5ff", "#9333ea"], // Purple 50/600
        ["#fff1f2", "#e11d48"], // Rose 50/600
        ["#fff7ed", "#ea580c"], // Orange 50/600
        ["#fefce8", "#ca8a04"], // Yellow 50/600
        ["#f8fafc", "#475569"], // Slate 50/600
    ];

    const idx = h % bgColors.length;
    const [bg, fg] = bgColors[idx];

    // Generate some deterministic geometry based on seed
    const shapeType = h % 3; // 0=circle, 1=rect, 2=triangle

    let shapeSvg = "";
    if (shapeType === 0) {
        shapeSvg = `<circle cx="50" cy="50" r="25" fill="${fg}" />`;
    } else if (shapeType === 1) {
        shapeSvg = `<rect x="25" y="25" width="50" height="50" rx="8" fill="${fg}" />`;
    } else {
        shapeSvg = `<polygon points="50,25 75,75 25,75" fill="${fg}" />`;
    }

    // SVG Template
    const svg = `
    <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="${bg}" />
        ${shapeSvg}
    </svg>
    `.trim();

    // Convert to Data URI
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};
