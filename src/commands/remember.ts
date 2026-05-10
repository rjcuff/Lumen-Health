import inquirer from 'inquirer';
import { addMemory, listMemories, deleteMemory } from '../db/queries';
import { blank, dim, val, good, printSuccess, DOT } from '../utils/format';

export async function runRemember(note: string | undefined): Promise<void> {
  if (note?.trim()) {
    addMemory(note.trim());
    blank();
    printSuccess(`remembered: "${note.trim()}"`);
    console.log(dim('  lumen will use this in every ai response'));
    blank();
    return;
  }

  const memories = listMemories();
  blank();

  if (memories.length === 0) {
    console.log(dim('nothing saved yet'));
    blank();
    console.log(dim('examples:'));
    console.log(dim('  lumen remember "training for a half marathon in october"'));
    console.log(dim('  lumen remember "recovering from a knee injury"'));
    console.log(dim('  lumen remember "trying to improve sleep — in bed by 10:30"'));
    blank();
    return;
  }

  for (const m of memories) {
    const date = m.created_at.split(' ')[0];
    console.log(
      dim(String(m.id).padStart(2) + '  ') +
      val(m.content) +
      dim('  ' + date)
    );
  }
  blank();

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'what would you like to do?',
    choices: [
      { name: 'add a note', value: 'add' },
      { name: 'remove a note', value: 'remove' },
      { name: 'done', value: 'done' },
    ],
  }]);

  if (action === 'add') {
    const { content } = await inquirer.prompt([{
      type: 'input',
      name: 'content',
      message: 'what should lumen remember?',
      validate: (v: string) => v.trim().length > 0 || 'cannot be empty',
      filter: (v: string) => v.trim(),
    }]);
    addMemory(content);
    blank();
    printSuccess(`remembered: "${content}"`);
  } else if (action === 'remove') {
    const { id } = await inquirer.prompt([{
      type: 'list',
      name: 'id',
      message: 'which note to remove?',
      choices: memories.map(m => ({ name: m.content, value: m.id })),
    }]);
    deleteMemory(id);
    blank();
    printSuccess('note removed');
  }

  blank();
}
