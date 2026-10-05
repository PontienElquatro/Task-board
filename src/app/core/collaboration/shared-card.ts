import { Task, Status } from '../../models';

export interface SharedCardTask {
  id:string; title:string; description:string; status:string; assignee_id:string|null;
}
export interface SharedCardSubtask {
  id:string; task_id:string; title:string; completed:boolean; assignee_id:string|null;
}

/** Presentation adapter only: never stores personal fields in the shared database. */
export function sharedCard(task:SharedCardTask, subtasks:SharedCardSubtask[]):Task {
  return {id:task.id,title:task.title,description:task.description,status:task.status as Status,
    priority:'low',subTasks:subtasks.filter(s=>s.task_id===task.id).map(s=>({id:s.id,title:s.title,completed:s.completed})),
    createdAt:new Date(0),userId:task.assignee_id||''};
}

export function matchesSharedAssignee(task:SharedCardTask, subtasks:SharedCardSubtask[], assignee:string):boolean {
  return !assignee || (assignee==='none' ? !task.assignee_id :
    task.assignee_id===assignee || subtasks.some(s=>s.task_id===task.id && s.assignee_id===assignee));
}
