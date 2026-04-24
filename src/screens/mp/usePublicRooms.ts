import { useEffect, useState } from 'react';
import { getPublicRooms, type PublicRoom } from '../../game/net/ColyseusClient';

export function usePublicRooms() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = () =>
      getPublicRooms()
        .then((r) => { if (alive) { setRooms(r); setError(false); } })
        .catch(() => { if (alive) setError(true); });
    poll();
    const id = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return { rooms, error };
}
