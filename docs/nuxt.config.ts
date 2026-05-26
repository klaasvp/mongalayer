export default defineNuxtConfig({
    extends: ['docus'],
    image: {
        provider: "none",
    },
    nitro: {
        awsAmplify: {
            // @ts-expect-error - Nuxt 4 uses Nitro v2 which doesn't support Node 24 yet
            runtime: 'nodejs24.x',

        },
    }
})
