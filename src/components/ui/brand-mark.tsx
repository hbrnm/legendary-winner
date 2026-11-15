import Image from "next/image";

/** Emblema Cămara; numele accesibil este dat de textul alăturat. */
export function BrandMark({ size = 48 }: { size?: number }) {
  return <Image src="/icons/icon-192.png" width={size} height={size} alt="" className="shrink-0 rounded-2xl" />;
}
