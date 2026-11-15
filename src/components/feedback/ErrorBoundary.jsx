'use client';
import { Component } from 'react';
import EmptyState from '@/components/common/EmptyState';
import { TriangleAlert } from 'lucide-react';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="card m-6"><EmptyState icon={TriangleAlert} title="This page had a problem" message="Please try again. If it keeps happening, tell the software provider."
      action={<button className="btn btn-primary" onClick={() => this.setState({ error: null })}>Try Again</button>} /></div>;
  }
}
