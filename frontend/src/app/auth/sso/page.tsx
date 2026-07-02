import AutoSignIn from './AutoSignIn';

type Props = {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
};

function getSafeCallbackUrl(callbackUrl?: string) {
  if (callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//')) {
    return callbackUrl;
  }

  return '/';
}

export default async function SsoPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackUrl = getSafeCallbackUrl(params.callbackUrl);
  const isBypass = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';

  return <AutoSignIn callbackUrl={callbackUrl} isBypass={isBypass} />;
}
