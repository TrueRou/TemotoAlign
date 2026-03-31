/// <reference types="@capacitor/cli" />

const config: import('@capacitor/cli').CapacitorConfig = {
    appId: 'fun.turou.temotoalign',
    appName: 'TemotoAlign',
    webDir: '.output/public',
    bundledWebRuntime: false,
    server: {
        androidScheme: 'https',
    },
}

export default config
