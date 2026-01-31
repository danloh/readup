import { useEffect, useState } from 'react';
import { PiUserCircle } from 'react-icons/pi';
import UserAvatar from '@/components/UserAvatar';
import { useAuth } from '@/context/AuthContext';
import { getProfile, UserProfile } from '@/services/bsky/auth';

const UserInfo: React.FC = () => {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const id = user?.did ?? user?.handle;
        const svc = user?.service;
        if (!id || !svc) {
          setProfile(null);
          return;
        }

        const prof = await getProfile(id, svc);
        setProfile(prof as UserProfile);
      } catch (e) {
        console.error('Failed to load profile:', e);
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.did, user?.service]);

  if (error && !loading) {
    return (<p className='mt-2 text-sm text-error'>Failed to load profile</p>)
  }

  return (
    <div className='flex items-center justify-center gap-2'>
      <div className='flex-shrink-0'>
        {profile?.avatar ? (
          <UserAvatar
            url={profile?.avatar}
            size={64}
            DefaultIcon={PiUserCircle}
            className='h-16 w-16'
            borderClassName='border-base-100 border-4'
          />
        ) : (
          <PiUserCircle className='h-16 w-16' />
        )}
      </div>

      <div className='flex flex-col items-start justify-center'>
        <h2 className='text-base-content text-xl font-bold'>
          {profile?.displayName || user?.handle}
        </h2>
        <div className='text-sm opacity-70'>
          <a href={`https://bsky.app}/profile/${user?.handle}`}>@{user?.handle}</a>
        </div>
        {/* {profile?.description ? (
          <p className='mt-2 max-w-prose text-sm text-base-content break-words'>
            {profile.description}
          </p>
        ) : error && !loading ? (
          <p className='mt-2 text-sm text-error'>Failed to load profile</p>
        ) : null} */}
        <button className='link text-xs' onClick={logout}>Log Out</button>
      </div>
    </div>
  );
};

export default UserInfo;
