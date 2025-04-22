import { spawn } from 'child_process';
import { resolve } from 'path';
import { writeFileSync } from 'fs';
import { ScriptMonitor } from '../src/utils/monitor';

interface TestResult {
    name: string;
    status: 'passed' | 'failed';
    duration: number;
    error?: string;
}

interface TestReport {
    timestamp: string;
    duration: number;
    totalTests: number;
    passed: number;
    failed: number;
    results: TestResult[];
}

async function runTest(name: string, command: string[]): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
        await new Promise<void>((resolve, reject) => {
            const process = spawn('npx', command, {
                stdio: 'pipe',
                env: { ...process.env, NODE_ENV: 'test' }
            });

            let output = '';
            process.stdout.on('data', (data) => {
                output += data;
                console.log(data.toString());
            });

            process.stderr.on('data', (data) => {
                output += data;
                console.error(data.toString());
            });

            process.on('exit', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(output));
                }
            });
        });

        return {
            name,
            status: 'passed',
            duration: Date.now() - startTime
        };
    } catch (error: any) {
        return {
            name,
            status: 'failed',
            duration: Date.now() - startTime,
            error: error.message
        };
    }
}

async function generateReport(results: TestResult[]): Promise<TestReport> {
    const report: TestReport = {
        timestamp: new Date().toISOString(),
        duration: results.reduce((acc, curr) => acc + curr.duration, 0),
        totalTests: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
    };

    // Save report
    writeFileSync(
        resolve(__dirname, '../reports/feature-test-report.json'),
        JSON.stringify(report, null, 2)
    );

    // Print summary
    console.log('\n=== Test Report ===');
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`Passed: ${report.passed}`);
    console.log(`Failed: ${report.failed}`);
    console.log(`Duration: ${(report.duration / 1000).toFixed(2)}s`);
    
    if (report.failed > 0) {
        console.log('\nFailed Tests:');
        report.results
            .filter(r => r.status === 'failed')
            .forEach(r => {
                console.log(`- ${r.name}`);
                console.log(`  Error: ${r.error}`);
            });
    }

    return report;
}

async function main() {
    const monitor = new ScriptMonitor('feature-tests');
    
    try {
        const tests = [
            {
                name: 'Blockchain Features',
                command: ['mocha', '-r', 'ts-node/register', 'test/integration/blockchain-tests.ts']
            },
            {
                name: 'Content Services',
                command: ['mocha', '-r', 'ts-node/register', 'test/integration/content-tests.ts']
            },
            {
                name: 'Social Media Integration',
                command: ['mocha', '-r', 'ts-node/register', 'test/integration/social-tests.ts']
            },
            {
                name: 'Community Features',
                command: ['mocha', '-r', 'ts-node/register', 'test/integration/community-tests.ts']
            }
        ];

        console.log('Starting feature tests...');
        const results = await Promise.all(
            tests.map(test => runTest(test.name, test.command))
        );

        const report = await generateReport(results);
        monitor.complete();

        // Exit with error if any tests failed
        if (report.failed > 0) {
            process.exit(1);
        }
    } catch (error) {
        monitor.fail(error as Error);
        throw error;
    }
}

main().catch(console.error); 