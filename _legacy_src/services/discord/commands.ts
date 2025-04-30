export const commands = [
    {
        name: 'tests',
        description: 'View and manage test results (Admin only)',
        type: 1, // CHAT_INPUT
        defaultPermission: false,
        options: [
            {
                name: 'action',
                description: 'Action to perform',
                type: 3, // STRING
                required: false,
                choices: [
                    {
                        name: 'View Results',
                        value: 'view'
                    },
                    {
                        name: 'Run All Tests',
                        value: 'run'
                    },
                    {
                        name: 'Clear History',
                        value: 'clear'
                    }
                ]
            },
            {
                name: 'service',
                description: 'Specific service to test',
                type: 3, // STRING
                required: false,
                choices: [
                    {
                        name: 'Music Promotion',
                        value: 'MusicPromotion'
                    },
                    {
                        name: 'Content',
                        value: 'Content'
                    },
                    {
                        name: 'Analytics',
                        value: 'Analytics'
                    },
                    {
                        name: 'Token Distribution',
                        value: 'TokenDistribution'
                    },
                    {
                        name: 'Community Engagement',
                        value: 'CommunityEngagement'
                    }
                ]
            }
        ]
    }
]; 