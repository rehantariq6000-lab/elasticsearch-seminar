import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// The row in PostgreSQL: the source of truth for every course.
@Entity('course')
export class Course {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 100 })
  lecturer: string;

  @Column({ type: 'int' })
  ects: number;

  @Column({ type: 'int', default: 30 })
  maxParticipants: number;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags: string[];
}
