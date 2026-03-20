import ChannelCommissionsClient from "./ui";

export default async function ChannelCommissionsPage(
  props: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(props.params);
  return <ChannelCommissionsClient channelId={id} />;
}
