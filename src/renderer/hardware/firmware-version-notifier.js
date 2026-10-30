// Connection identifies the product; version compatibility is checked afterwards.
export const createFirmwareVersionNotifier = notify => {
    let prompted = null;
    return ({connected, compatible, identity, version, busy = false, locale}) => {
        if (!connected) {
            prompted = null;
            return;
        }
        if (compatible || busy) return;
        const key = `${identity}:${version}`;
        if (prompted === key) return;
        prompted = key;
        Promise.resolve().then(() => notify({version, locale}))
            .catch(() => {});
    };
};
