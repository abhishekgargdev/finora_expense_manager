"use client";

import * as React from "react";
import { FolderPlus, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import EmptyState from "@/components/finance/EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import LoaderOverlay from "@/components/loader/LoaderOverlay";
import PageSkeleton from "@/components/loader/PageSkeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategories } from "@/hooks/useCategories";
import { staggerContainer } from "@/lib/motion";

export default function CategoriesPage() {
  const { categories, isLoading, isMutating, create, update, remove } = useCategories();
  const [tab, setTab] = React.useState<"Expense" | "Income">("Expense");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<{ id: string; name: string } | null>(null);
  const [categoryName, setCategoryName] = React.useState("");

  const filteredCategories = React.useMemo(() => {
    return categories.filter((cat) => cat.type === tab);
  }, [categories, tab]);

  function openCreate() {
    setEditingCategory(null);
    setCategoryName("");
    setDialogOpen(true);
  }

  function openEdit(cat: { id: string; name: string }) {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setDialogOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return toast.error("Category name cannot be empty.");

    try {
      if (editingCategory) {
        await update(editingCategory.id, name);
        toast.success("Category renamed successfully.");
      } else {
        await create(name, tab);
        toast.success("Category added successfully.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save category.");
    }
  }

  const [categoryToDelete, setCategoryToDelete] = React.useState<{ id: string; name: string } | null>(null);
  async function deleteCategory() {
    if (!categoryToDelete) return;
    try {
      await remove(categoryToDelete.id);
      toast.success("Category deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete category.");
    }
  }

  if (isLoading) return <PageSkeleton variant="table" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Categories</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage your custom transaction categories.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Add Category
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "Expense" | "Income")}>
        <TabsList>
          <TabsTrigger value="Expense">Expense Categories</TabsTrigger>
          <TabsTrigger value="Income">Income Categories</TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredCategories.length === 0 ? (
        <EmptyState
          icon={<Tag />}
          title={`No ${tab.toLowerCase()} categories found`}
          description={`Create categories to start organizing your ${tab.toLowerCase()} transactions.`}
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Add Category
            </Button>
          }
        />
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {filteredCategories.map((cat) => (
            <motion.div
              key={cat.id}
              variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
              className="card flex items-center justify-between p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Tag className="size-4" />
                </span>
                <span className="font-medium text-sm truncate max-w-[140px]" title={cat.name}>
                  {cat.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(cat)}
                  aria-label={`Edit ${cat.name}`}
                  disabled={cat.name === "Other"}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setCategoryToDelete(cat)}
                  aria-label={`Delete ${cat.name}`}
                  disabled={cat.name === "Other"}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Rename Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Change the name of this category. Transactions will update automatically."
                : `Create a new category for your ${tab.toLowerCase()} transactions.`}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g. Subscriptions, Gifts..."
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingCategory ? "Save Changes" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!categoryToDelete}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
        title="Delete Category?"
        description={`Are you sure you want to delete the category "${categoryToDelete?.name}"? Any transactions using this category will be reset to "Other".`}
        onConfirm={deleteCategory}
      />
      <LoaderOverlay show={isMutating} label="Updating categories..." />
    </div>
  );
}
