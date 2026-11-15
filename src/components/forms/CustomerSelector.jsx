'use client';
import { useState } from 'react';
import { useGetCustomersQuery, useGetCustomerQuery } from '@/redux/api/customerApi';
import { useFormContext } from 'react-hook-form';
import Combo from './Combo';

export default function CustomerSelector({ name, value, onChange, label = 'Customer', placeholder = 'Search by name, mobile or CNIC…', params = {}, onPick, ...rest }) {
  const [q, setQ] = useState(''); const ctx = useFormContext();
  const current = name && ctx ? ctx.watch(name) : value;
  const { data, isFetching } = useGetCustomersQuery({ search: q, pageSize: 8, status: 'Active', ...params });
  const { data: one } = useGetCustomerQuery(current, { skip: !current });
  const opts = (data?.items || []).map((c) => ({ value: c.id, label: c.name, sub: c.mobile, image: c.photo, raw: c }));
  return <Combo name={name} value={value} onChange={onChange} label={label} placeholder={placeholder} options={opts} loading={isFetching} onSearch={setQ} onPick={onPick}
    selected={current ? { label: one?.name || opts.find((o) => o.value === current)?.label || 'Customer', sub: one?.mobile, image: one?.photo } : null} {...rest} />;
}
