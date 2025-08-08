export interface FormattedIssue {
  title: string;
  body: string;
}

export function formatIssue(issue: any): FormattedIssue {
  const title = `#${issue.number} ${issue.title}`;
  
  const labels = issue.labels?.length > 0
    ? issue.labels.map((l: any) => `\`${l.name}\``).join(' ')
    : '';
  
  const assignees = issue.assignees?.length > 0
    ? issue.assignees.map((a: any) => `@${a.login}`).join(', ')
    : 'None';
  
  const body = `
**GitHub Issue**: ${issue.html_url}
**Author**: @${issue.user.login}
**State**: ${issue.state}
**Created**: ${new Date(issue.created_at).toLocaleString()}
${labels ? `**Labels**: ${labels}` : ''}
**Assignees**: ${assignees}

---

${issue.body || '*No description provided*'}
  `.trim();
  
  return { title, body };
}