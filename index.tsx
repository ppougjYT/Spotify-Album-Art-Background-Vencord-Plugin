import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, Button, Text } from "@webpack/common";
import { definePluginSettings } from "@api/Settings";

let currentArt: string | null = null;
let interval: any = null;
let observer: MutationObserver | null = null;

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const settings = definePluginSettings({
    coverSize: {
        type: OptionType.NUMBER,
        description: "Size of the album cover as a percentage",
        default: 100,
        min: 50,
        max: 200
    },

    noRepeat: {
        type: OptionType.BOOLEAN,
        description: "Prevent album cover from repeating",
        default: true
    },

    emptyColor: {
        type: OptionType.STRING,
        description: "Fallback color if no image is set",
        default: "#0a0a0a"
    },

    emptyImage: {
        type: OptionType.STRING,
        description: "Base64 image used for empty space",
        default: ""
    },

    uploadButton: {
        type: OptionType.COMPONENT,
        description: "Upload image or GIF for empty background",
        component: () => {
            const fileName =
                settings.store.emptyImage
                    ? "Custom image loaded"
                    : "No image selected";

            let inputRef: HTMLInputElement | null = null;

            return (
                <div style={{ marginTop: "8px" }}>
                    <div style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center"
                    }}>
                        <Button
                            size={Button.Sizes.SMALL}
                            onClick={() => inputRef?.click()}
                        >
                            Choose File
                        </Button>

                        <Text variant="text-sm/normal">
                            {fileName}
                        </Text>

                        {settings.store.emptyImage && (
                            <Button
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.RED}
                                onClick={() => {
                                    settings.store.emptyImage = "";
                                    applyArt();
                                }}
                            >
                                Clear Image
                            </Button>
                        )}
                    </div>

                    <input
                        ref={r => inputRef = r}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={async e => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            const base64 = await fileToBase64(file);
                            settings.store.emptyImage = base64;

                            applyArt();
                        }}
                    />
                </div>
            );
        }
    }
});

function applyArt() {
    if (!currentArt) return;

    const size = settings.store.coverSize;
    const repeat = settings.store.noRepeat ? "no-repeat" : "repeat";

    document.documentElement.style.setProperty(
        "--background-image",
        `url('${currentArt}')`
    );

    document.documentElement.style.setProperty(
        "--background-image-size",
        `${size}%`
    );

    document.documentElement.style.setProperty(
        "--background-image-repeat",
        repeat
    );

    // Empty space handling
    if (settings.store.noRepeat) {
        if (settings.store.emptyImage) {
            document.body.style.backgroundImage =
                `url('${settings.store.emptyImage}')`;

            document.body.style.backgroundSize = "cover";
            document.body.style.backgroundPosition = "center";
        } else {
            document.body.style.backgroundImage = "";
            document.body.style.backgroundColor =
                settings.store.emptyColor;
        }
    } else {
        document.body.style.backgroundImage = "";
        document.body.style.backgroundColor = "";
    }
}

export default definePlugin({
    name: "Spotify Frosted Background",
    description: "Spotify album art for frosted glass background",
    authors: [{ name: "ppougj" }],
    settings,

    start() {
        FluxDispatcher.subscribe("SPOTIFY_PLAYER_STATE", this.onSpotify);

        interval = setInterval(applyArt, 1000);

        observer = new MutationObserver(() => applyArt());
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["style"]
        });

        applyArt();
    },

    stop() {
        FluxDispatcher.unsubscribe("SPOTIFY_PLAYER_STATE", this.onSpotify);
        clearInterval(interval);
        observer?.disconnect();
        observer = null;

        document.documentElement.style.removeProperty("--background-image");
        document.documentElement.style.removeProperty("--background-image-size");

        document.body.style.backgroundImage = "";
        document.body.style.backgroundColor = "";
    },

    onSpotify(data: any) {
        const art = data?.track?.album?.image?.url;

        if (art) {
            currentArt = art;
            applyArt();
        }
    }
});
