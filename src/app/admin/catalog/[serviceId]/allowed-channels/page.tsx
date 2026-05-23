import AdminServiceAllowedChannelsClient from "./ui";

export default async function AdminServiceAllowedChannelsPage(
  props: { params: Promise<{ serviceId: string }> | { serviceId: string } }
) {
  const { serviceId } = await Promise.resolve(props.params);
  return <AdminServiceAllowedChannelsClient serviceId={serviceId} />;
}
