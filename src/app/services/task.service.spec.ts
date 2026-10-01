import { TestBed } from '@angular/core/testing';
import { TaskService } from './task.service';
import { STORAGE_PROVIDER, StorageProvider } from '../providers/storage.provider';
import { Task } from '../models';
import { moveTask, normalizeTasks, isOverdue } from '../models/task-utils';

const task = (id: string, status: Task['status'] = 'todo', order = 0): Task => ({
  id, title: 'Tâche ' + id, description: '', status, order, priority: 'medium',
  createdAt: new Date(2026, 8, 24), userId: 'default', subTasks: [], tags: []
});
describe('Task data integrity', () => {
  it('reorders without losing a task or mutating the input', () => {
    const input = [task('a', 'todo', 0), task('b', 'todo', 1), task('c', 'todo', 2)];
    expect(moveTask(input, 'c', 'todo', 0).map(t => t.id)).toEqual(['c', 'a', 'b']);
    expect(input.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });
  it('moves across columns while preserving archives', () => {
    const input = [task('a'), task('b', 'done'), { ...task('archive', 'done'), archived: true }];
    const result = moveTask(input, 'a', 'done', 0);
    expect(result.length).toBe(3);
    expect(result.filter(t => !t.archived && t.status === 'done').map(t => t.id)).toEqual(['a', 'b']);
    expect(result.find(t => t.id === 'archive')?.archived).toBeTrue();
  });
  it('rejects malformed imports and duplicate ids', () => {
    expect(() => normalizeTasks({})).toThrow();
    expect(() => normalizeTasks([task('a'), task('a')])).toThrow();
    expect(() => normalizeTasks([{ ...task('a'), dueDate: 'not-a-date' }])).toThrow();
    expect(() => normalizeTasks([{ ...task('a'), title: '  ' }])).toThrow();
  });
  it('migrates older records and restores dates', () => {
    const old = JSON.parse(JSON.stringify(task('a')));
    delete old.subTasks;
    const result = normalizeTasks([old])[0];
    expect(result.createdAt instanceof Date).toBeTrue();
    expect(result.subTasks).toEqual([]);
    expect(result.archived).toBeFalse();
  });
  it('does not mark today or completed tasks overdue', () => {
    const today = new Date(2026, 8, 24, 20);
    expect(isOverdue({ ...task('a'), dueDate: new Date(2026, 8, 24) }, today)).toBeFalse();
    expect(isOverdue({ ...task('a'), dueDate: new Date(2026, 8, 23) }, today)).toBeTrue();
    expect(isOverdue({ ...task('a', 'done'), dueDate: new Date(2026, 8, 23) }, today)).toBeFalse();
  });
});
describe('TaskService', () => {
  let service: TaskService;
  let storage: jasmine.SpyObj<StorageProvider>;
  beforeEach(() => {
    storage = jasmine.createSpyObj('storage', ['getItem', 'setItem', 'removeItem']);
    storage.getItem.and.returnValue([task('a'), task('b')]);
    TestBed.configureTestingModule({ providers: [{ provide: STORAGE_PROVIDER, useValue: storage }] });
    service = TestBed.inject(TaskService);
  });
  it('archives, restores and undoes persisted actions', () => {
    service.archiveTask('a');
    expect(service.activeTasks().length).toBe(1);
    expect(storage.setItem).toHaveBeenCalled();
    service.restoreTask('a');
    expect(service.activeTasks().length).toBe(2);
    service.undo();
    expect(service.archivedTasks().map(t => t.id)).toEqual(['a']);
  });
  it('merges an import without overwriting existing tasks', () => {
    service.importTasks([{ ...task('a'), title: 'Overwrite' }, task('c')]);
    expect(service.tasks().length).toBe(3);
    expect(service.tasks()[0].title).toBe('Tâche a');
  });
  it('does not mutate state if storage fails', () => {
    storage.setItem.and.throwError('quota');
    expect(() => service.archiveTask('a')).toThrow();
    expect(service.archivedTasks().length).toBe(0);
    expect(service.canUndo()).toBeFalse();
  });
  it('filters tags and subtask text', () => {
    service.updateTask({ ...task('a'), tags: ['Design'], subTasks: [{ id: 's', title: 'Maquette', completed: false }] });
    service.searchTerm.set('maquette');
    expect(service.filteredTasks().map(t => t.id)).toEqual(['a']);
    service.searchTerm.set(''); service.filterTag.set('Design');
    expect(service.filteredTasks().map(t => t.id)).toEqual(['a']);
  });
  it('never overwrites corrupt saved data', () => {
    TestBed.resetTestingModule();
    storage.getItem.and.returnValue({ broken: true });
    TestBed.configureTestingModule({ providers: [{ provide: STORAGE_PROVIDER, useValue: storage }] });
    const corrupt = TestBed.inject(TaskService);
    expect(corrupt.loadFailed()).toBeTrue();
    expect(() => corrupt.importTasks([task('new')])).toThrow();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('persists subtask changes without mutating the previous state and supports undo', () => {
    service.updateTask({ ...task('a'), subTasks: [{ id: 's', title: 'Étape', completed: false }] });
    const previous = service.tasks();
    service.toggleSubTask('a', 's');
    expect(service.tasks()[0].subTasks[0].completed).toBeTrue();
    expect(previous[0].subTasks[0].completed).toBeFalse();
    service.undo();
    expect(service.tasks()[0].subTasks[0].completed).toBeFalse();
  });
  it('appends an edited task to the target column without conflicting order', () => {
    service.importTasks([task('c', 'done', 8)]);
    service.updateTask({ ...task('a', 'done'), order: 0 });
    expect(service.tasks().find(t => t.id === 'a')?.order).toBe(9);
  });
  it('rejects edits to missing tasks', () => {
    expect(() => service.updateTask(task('missing'))).toThrow();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
