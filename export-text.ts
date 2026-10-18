import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export type TxtExportResult = "downloaded" | "shared" | "saved" | "cancelled";

function fileName() {
  return `movie-recap-${Date.now()}.txt`;
}

export async function exportRetellingTxt(text: string): Promise<TxtExportResult> {
  const content = text.trim();
  if (!content) throw new Error("empty_text");

  if (Platform.OS === "web") {
    if (typeof document === "undefined" || typeof URL === "undefined") throw new Error("browser_unavailable");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName();
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    return "downloaded";
  }

  if (await Sharing.isAvailableAsync()) {
    const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!directory) throw new Error("file_directory_unavailable");
    const uri = `${directory}${fileName()}`;
    await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(uri, { mimeType: "text/plain", UTI: "public.plain-text" });
    return "shared";
  }

  if (Platform.OS === "android") {
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) return "cancelled";
    const uri = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, fileName(), "text/plain");
    await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
    return "saved";
  }

  throw new Error("sharing_unavailable");
}
