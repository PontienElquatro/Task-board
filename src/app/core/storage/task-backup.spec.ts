import { createTaskBackup, readTaskBackup } from './task-backup';
import { Task } from '../../models';

describe('Ma’at backup compatibility', () => {
  const tasks: Task[] = [{
    id:'one',title:'Tâche',description:'',status:'todo',priority:'medium',
    subTasks:[],userId:'default',createdAt:new Date('2026-01-01')
  }];
  it('exports the new identity and reads it back', () => {
    const backup = createTaskBackup(tasks);
    expect(backup.app).toBe('Maat');
    expect(readTaskBackup(JSON.parse(JSON.stringify(backup)))[0].title).toBe('Tâche');
  });
  it('continues reading historical MyTaskBoard exports', () => {
    expect(readTaskBackup({app:'MyTaskBoard',version:2,tasks})[0].id).toBe('one');
  });
  it('recovers tasks from a workspace safety backup', () => {
    expect(readTaskBackup({app:'Maat',version:1,data:{mytaskboard_tasks:tasks}})[0].id).toBe('one');
  });
  it('rejects unknown brands and versions', () => {
    expect(()=>readTaskBackup({app:'Other',version:2,tasks})).toThrow();
    expect(()=>readTaskBackup({app:'Maat',version:99,tasks})).toThrow();
  });
});
