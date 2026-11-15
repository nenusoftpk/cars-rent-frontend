'use client';
import FormSelect from './FormSelect';
import { TIME_SLOTS } from '@/lib/dates';
export default function FormTimePicker({ label = 'Time', ...props }) { return <FormSelect label={label} options={TIME_SLOTS} placeholder={null} {...props} />; }
