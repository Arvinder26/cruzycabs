import Image from "next/image";

export function BrandLogo({ priority = false }: { priority?: boolean }) {
  return <span className="brand-logo">
    <Image
      src="/images/cruzycabs-logo.png"
      alt="cruzycabs"
      width={1672}
      height={941}
      sizes="220px"
      priority={priority}
    />
  </span>;
}
