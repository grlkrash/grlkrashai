import { EventEmitter } from 'events';
import natural from 'natural';

interface ParsedProposal {
    title: string;
    description: string;
    executionData?: string;
}

interface ParsedVote {
    proposalId: number;
    support: boolean;
}

export class NLPService extends EventEmitter {
    private tokenizer: natural.WordTokenizer;
    private classifier: natural.BayesClassifier;

    constructor() {
        super();
        this.tokenizer = new natural.WordTokenizer();
        this.classifier = new natural.BayesClassifier();
        this.trainClassifier();
    }

    private trainClassifier() {
        // Train for vote classification
        this.classifier.addDocument('yes support agree approve in favor +1', 'support');
        this.classifier.addDocument('no against disagree reject oppose -1', 'against');
        this.classifier.train();
    }

    async parseProposal(text: string): Promise<ParsedProposal> {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        if (sentences.length === 0) {
            throw new Error('Could not parse proposal text');
        }

        // Use the first sentence as title
        const title = sentences[0].trim();
        
        // Use remaining sentences as description
        const description = sentences.slice(1).join('. ').trim();

        // Extract any technical details or execution data
        const executionData = this.extractExecutionData(text);

        return {
            title,
            description: description || title,
            executionData
        };
    }

    async parseVote(text: string): Promise<ParsedVote> {
        const tokens = this.tokenizer.tokenize(text.toLowerCase());
        
        // Try to extract proposal ID
        const proposalId = this.extractProposalId(text);
        if (!proposalId) {
            throw new Error('Could not determine which proposal to vote on');
        }

        // Determine vote sentiment
        const voteText = tokens.join(' ');
        const classification = this.classifier.classify(voteText);
        const support = classification === 'support';

        return {
            proposalId,
            support
        };
    }

    private extractProposalId(text: string): number | null {
        // Look for patterns like "proposal 123" or "#123"
        const matches = text.match(/(?:proposal|#)\s*(\d+)/i);
        return matches ? parseInt(matches[1]) : null;
    }

    private extractExecutionData(text: string): string | undefined {
        // Look for technical details in code blocks or after specific markers
        const matches = text.match(/```([^`]+)```/);
        return matches ? matches[1].trim() : undefined;
    }

    async cleanup(): Promise<void> {
        this.removeAllListeners();
    }
} 