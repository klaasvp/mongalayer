export default async function (globalConfig: any, projectConfig: any) {
    console.log("Tearing down JEST");

    await globalThis.$mdb.client.close();
    await globalThis.$md.stop();
}