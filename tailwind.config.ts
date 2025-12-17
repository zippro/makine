import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                card: "var(--card)",
                "card-hover": "var(--card-hover)",
                border: "var(--border)",
                primary: "var(--primary)",
                "primary-hover": "var(--primary-hover)",
                success: "var(--success)",
                warning: "var(--warning)",
                error: "var(--error)",
                muted: "var(--muted)",
            },
        },
    },
    plugins: [],
};
export default config;
