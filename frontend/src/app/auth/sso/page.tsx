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

  return <AutoSignIn callbackUrl={callbackUrl} />;
}
