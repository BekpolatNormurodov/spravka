import { customAlphabet } from "nanoid";

// 15-20 belgidan iborat, faqat harf va sonlardan iborat o'zgarmas unique id
const alphabet =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const generate = customAlphabet(alphabet, 18);

export function generateQrId(): string {
  return generate();
}
