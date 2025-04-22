import { ChallengeTemplate } from './ChallengeTemplates';

export class TemplateFormatter {
    static getTemplateFormat(): string {
        return `To create a new challenge template, use the following format:

name: Challenge Name
description: Challenge Description
type: [engagement|promotion|holding|community]
minHolding: [number]
duration: [number of days]
tasks:
  - type: [task type]
    count: [number]
    points: [number]
  [repeat for more tasks...]
rewards:
  tokens: [number]
  points: [number]
  nft: [optional: nft name]
automation: [optional]
  frequency: [daily|weekly|monthly]
  platforms: [comma-separated platform names]`;
    }

    static parseTemplateInput(input: string): ChallengeTemplate | Error {
        try {
            const lines = input.split('\n');
            const template: any = {
                requirements: { tasks: [] },
                rewards: {},
                automationRules: {}
            };

            let currentSection = '';

            for (const line of lines) {
                if (!line.trim()) continue;

                if (line.startsWith('tasks:')) {
                    currentSection = 'tasks';
                    continue;
                }

                if (line.startsWith('rewards:')) {
                    currentSection = 'rewards';
                    continue;
                }

                if (line.startsWith('automation:')) {
                    currentSection = 'automation';
                    continue;
                }

                if (line.startsWith('  - ') && currentSection === 'tasks') {
                    const task = this.parseTask(line);
                    template.requirements.tasks.push(task);
                    continue;
                }

                const [key, value] = line.split(':').map(s => s.trim());
                
                switch (currentSection) {
                    case '':
                        if (key === 'minHolding' || key === 'duration') {
                            if (!template.requirements) template.requirements = {};
                            template.requirements[key] = parseInt(value);
                        } else {
                            template[key] = value;
                        }
                        break;
                    case 'rewards':
                        if (key === 'nft') {
                            template.rewards.nft = {
                                type: 'badge',
                                metadata: {
                                    name: value,
                                    description: `Awarded for completing ${template.name}`
                                }
                            };
                        } else {
                            template.rewards[key] = parseInt(value);
                        }
                        break;
                    case 'automation':
                        template.automationRules[key] = 
                            key === 'platforms' 
                                ? value.split(',').map(p => p.trim())
                                : value;
                        break;
                }
            }

            this.validateTemplate(template);
            return template;
        } catch (error) {
            return new Error(`Invalid template format: ${error.message}`);
        }
    }

    private static parseTask(line: string): any {
        const taskData = line.substring(4).split(',');
        const task: any = {};
        
        for (const data of taskData) {
            const [key, value] = data.split(':').map(s => s.trim());
            task[key] = key === 'type' ? value : parseInt(value);
        }

        return task;
    }

    private static validateTemplate(template: any): void {
        const requiredFields = ['name', 'description', 'type'];
        for (const field of requiredFields) {
            if (!template[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!template.requirements?.tasks?.length) {
            throw new Error('At least one task is required');
        }

        if (!template.rewards.tokens && !template.rewards.points && !template.rewards.nft) {
            throw new Error('At least one reward type is required');
        }
    }
} 