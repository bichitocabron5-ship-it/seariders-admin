// src/app/admin/catalog/[serviceId]/options/page.tsx
import AdminServiceOptionsClient from "./ui";

export default async function AdminServiceOptionsPage(
  props: { params: Promise<{ serviceId: string }> | { serviceId: string } }
) {
  const { serviceId } = await Promise.resolve(props.params);
  return <AdminServiceOptionsClient serviceId={serviceId} />;
}
