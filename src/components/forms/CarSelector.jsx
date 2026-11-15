'use client';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useGetCarsQuery, useGetCarQuery } from '@/redux/api/carApi';
import Combo from './Combo';

export default function CarSelector({ name, value, onChange, label = 'Car', placeholder = 'Search car name or number plate…', params = {}, onPick, ...rest }) {
  const [q, setQ] = useState(''); const ctx = useFormContext();
  const current = name && ctx ? ctx.watch(name) : value;
  const { data, isFetching } = useGetCarsQuery({ search: q, pageSize: 12, ...params });
  const { data: one } = useGetCarQuery(current, { skip: !current });
  const opts = (data?.items || []).map((c) => ({ value: c.id, label: `${c.name}`, sub: c.plate, image: c.image, tag: c.status !== 'Available' ? c.status : '', raw: c }));
  return <Combo name={name} value={value} onChange={onChange} label={label} placeholder={placeholder} options={opts} loading={isFetching} onSearch={setQ} onPick={onPick} round={false}
    selected={current ? { label: one?.name || opts.find((o) => o.value === current)?.label || 'Car', sub: one?.plate, image: one?.image } : null} {...rest} />;
}
