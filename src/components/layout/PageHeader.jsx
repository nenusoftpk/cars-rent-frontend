import PageBanner from './PageBanner';
// PageHeader = the standard page title area. breadcrumb: [{label, href?}]
export default function PageHeader({ title, subtitle, breadcrumb, actions, right }) {
  return <PageBanner title={title} subtitle={subtitle} breadcrumb={breadcrumb ?? [{ label: title }]} actions={actions} right={right} />;
}
