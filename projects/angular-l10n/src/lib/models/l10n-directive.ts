import { Input, AfterViewInit, OnChanges, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { getTargetNode } from './bfs';
import { L10nTranslationService } from '../services/l10n-translation.service';

export abstract class L10nDirective implements AfterViewInit, OnChanges, OnDestroy {

    @Input() public value: string;

    @Input() public innerHTML: string;

    private text: string;
    private attributes: any[];

    private element: any;
    private renderNode: any;
    private nodeValue: string;

    private textObserver: MutationObserver;

    private readonly TEXT_MUTATION_CONFIG = { subtree: true, characterData: true };

    private readonly SELECTOR = /^l10n-/;

    private destroy = new Subject<boolean>();

    constructor(protected el: ElementRef, protected renderer: Renderer2, protected translation: L10nTranslationService) { }

    public ngAfterViewInit(): void {
        if (this.el && this.el.nativeElement) {
            this.element = this.el.nativeElement;
            this.renderNode = getTargetNode(this.element);
            this.text = this.getText();
            this.attributes = this.getAttributes();
            this.addTextListener();
            this.addTranslationListener();
        }
    }

    public ngOnChanges(): void {
        if (this.text) {
            if (this.nodeValue == null || this.nodeValue === '') {
                if (this.value) {
                    this.text = this.value;
                } else if (this.innerHTML) {
                    this.text = this.innerHTML;
                }
            }
            this.replaceText();
        }
        if (this.attributes && this.attributes.length > 0) {
            this.replaceAttributes();
        }
    }

    public ngOnDestroy(): void {
        this.destroy.next(true);
        this.removeTextListener();
    }

    protected abstract getValue(text: string): string;

    private getText(): string {
        let text = '';
        if (this.element.childNodes.length > 0) {
            text = this.getNodeValue();
        } else if (this.value) {
            text = this.value;
        } else if (this.innerHTML) {
            text = this.innerHTML;
        }
        return text;
    }

    private getNodeValue(): string {
        this.nodeValue = this.renderNode != null ? this.renderNode.nodeValue as string : '';
        return this.nodeValue ? this.nodeValue.trim() : '';
    }

    private getAttributes(): any[] {
        const attributes: any[] = [];
        if (this.element.attributes) {
            for (const attr of this.element.attributes) {
                if (attr && this.SELECTOR.test(attr.name)) {
                    const name = attr.name.substr(5);
                    for (const targetAttr of this.element.attributes) {
                        if (new RegExp('^' + name + '$').test(targetAttr.name)) {
                            attributes.push({ name, text: targetAttr.value });
                        }
                    }
                }
            }
        }
        return attributes;
    }

    private addTextListener(): void {
        if (typeof MutationObserver !== 'undefined') {
            this.textObserver = new MutationObserver(() => {
                this.renderNode = getTargetNode(this.element);
                this.text = this.getText();
                this.replaceText();
            });
            this.textObserver.observe(this.renderNode, this.TEXT_MUTATION_CONFIG);
        }
    }

    private removeTextListener(): void {
        if (typeof this.textObserver !== 'undefined') {
            this.textObserver.disconnect();
        }
    }

    private addTranslationListener(): void {
        this.translation.onChange().pipe(takeUntil(this.destroy)).subscribe({
            next: () => {
                this.replaceText();
                this.replaceAttributes();
            }
        });
    }

    private replaceText(): void {
        if (this.text) {
            this.setText(this.getValue(this.text));
        }
    }

    private replaceAttributes(): void {
        if (this.attributes.length > 0) {
            this.setAttributes(this.getAttributesData());
        }
    }

    private setText(value: string): void {
        if (value) {
            if (this.nodeValue && this.text) {
                this.removeTextListener();
                this.renderer.setValue(this.renderNode, this.nodeValue.replace(this.text, value));
                this.addTextListener();
            } else if (this.value) {
                this.renderer.setAttribute(this.element, 'value', value);
            } else if (this.innerHTML) {
                this.renderer.setProperty(this.element, 'innerHTML', value);
            }
        }
    }

    private setAttributes(data: any): void {
        for (const attr of this.attributes) {
            this.renderer.setAttribute(this.element, attr.name, data[attr.text]);
        }
    }

    private getAttributesData(): any {
        const texts = this.getAttributesTexts();
        const data: any = {};
        for (const text of texts) {
            data[text] = this.getValue(text);
        }
        return data;
    }

    private getAttributesTexts(): string[] {
        return this.attributes.map(attr => attr.text);
    }

}